import { useState } from "react";
import { motion } from "framer-motion";
import type { Message } from "../../lib/api";
import { serverDate, when } from "../../lib/time";
import { useAuthStore } from "../../stores/authStore";
import { useReminderStore } from "../../stores/reminderStore";
import Presence from "../ui/Presence";

const EASE = [0.22, 1, 0.36, 1] as const;

type Suggestion = NonNullable<Message["suggestion"]>;
type State = "set" | "waiting" | "removed" | "changed";

const LABEL: Record<State, string> = {
    set: "Reminder",
    waiting: "Waiting for your yes",
    removed: "Removed for you",
    changed: "Plan changed since",
};

/** The one action each state offers: its text, its accessible name, and the status it sets. */
const ACTION: Partial<Record<State, { text: string; name: string; status: "confirmed" | "dismissed" }>> = {
    set: { text: "Undo", name: "Undo reminder", status: "dismissed" },
    waiting: { text: "Count me in", name: "Count me in", status: "confirmed" },
    removed: { text: "Restore", name: "Restore reminder", status: "confirmed" },
};

/**
 * What the assistant posts once people agree on a time. Each reader has their
 * own reminder for the plan, so Undo only takes it off their list. In a group,
 * whoever hasn't said yes yet holds a proposed one until they count themselves in.
 * A personal reminder ("remind me to…") is one person's; everyone else just sees whose it is.
 */
export default function ReminderCard({ suggestion }: { suggestion: Suggestion }) {
    const plan = String(suggestion.parameters.plan ?? "");
    const dueAt = String(suggestion.parameters.due_at ?? "");
    const personalFor = String(suggestion.parameters.personal_for ?? "");
    const personalName = String(suggestion.parameters.personal_name ?? "") || "someone else";
    const me = useAuthStore((s) => s.user?.id);
    const mine = useReminderStore((s) => s.reminders.find((r) => r.message_id === plan));
    const loaded = useReminderStore((s) => s.loaded);
    const update = useReminderStore((s) => s.update);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const [now] = useState(() => Date.now());

    const at = mine?.due_at ?? dueAt;
    const past = at !== "" && serverDate(at).getTime() < now;
    const forOther = personalFor !== "" && personalFor !== me;
    const state: State | null =
        forOther || !loaded
            ? null
            : !mine
              ? "changed"
              : mine.status === "dismissed"
                ? "removed"
                : mine.status === "proposed"
                  ? "waiting"
                  : "set";
    const action = state && mine && !past ? ACTION[state] : undefined;

    const act = async () => {
        if (!mine || !action) return;
        setBusy(true);
        setFailed(false);
        try {
            await update(mine.id, { status: action.status });
        } catch {
            setFailed(true);
        } finally {
            setBusy(false);
        }
    };

    return (
        <motion.section
            aria-label={`Reminder: ${suggestion.label}`}
            className="mt-4 flex w-full max-w-[460px] items-center gap-4 rounded-2xl border border-sage-line bg-sage-wash px-5 py-4"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
        >
            <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-meta font-medium text-sage">
                    <Presence />
                    {forOther ? `Reminder for ${personalName}` : LABEL[state ?? "set"]}
                </p>
                <p className="mt-2 truncate text-body font-medium tracking-[-0.01em] text-ink">{suggestion.label}</p>
                {at && (
                    <time dateTime={at} className="tnum text-meta text-ink-3">
                        {when(at, now)}
                    </time>
                )}
                {failed && (
                    <p role="alert" className="mt-1 text-meta text-ink-2">
                        That didn&rsquo;t save. Try again.
                    </p>
                )}
            </div>
            {action && (
                <button
                    type="button"
                    className="btn btn-quiet h-10 shrink-0 px-3.5 text-sm font-medium"
                    onClick={() => void act()}
                    disabled={busy}
                    aria-label={`${action.name}: ${suggestion.label}`}
                >
                    {action.text}
                </button>
            )}
        </motion.section>
    );
}
