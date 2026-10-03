import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Message } from "../../lib/api";
import { serverDate, when } from "../../lib/time";
import { useAuthStore } from "../../stores/authStore";
import { useReminderStore } from "../../stores/reminderStore";
import Presence from "../ui/Presence";
import { EASE, rise } from "../../lib/motion";

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
export default function ReminderCard({ suggestion, live }: { suggestion: Suggestion; live: boolean }) {
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
            className="mt-4 flex w-full max-w-[460px] items-center gap-4 rounded-2xl border border-accent-line bg-accent-wash px-5 py-4"
            // A fresh plan settles in just after the words that announced it; history doesn't replay.
            initial={live ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.15, ease: EASE }}
        >
            <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-meta font-medium text-accent">
                    <Presence />
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.span key={forOther ? "other" : (state ?? "set")} {...rise}>
                            {forOther ? `Reminder for ${personalName}` : LABEL[state ?? "set"]}
                        </motion.span>
                    </AnimatePresence>
                </p>
                <p className="mt-2 truncate text-body font-medium tracking-[-0.01em] text-ink">{suggestion.label}</p>
                {at && (
                    <time dateTime={at} className="tnum text-meta text-ink-3">
                        {when(at, now)}
                    </time>
                )}
                <AnimatePresence>
                    {failed && (
                        <motion.p role="alert" className="mt-1 text-meta text-ink-2" {...rise}>
                            That didn&rsquo;t save. Try again.
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
            <AnimatePresence mode="wait" initial={false}>
                {action && (
                    <motion.button
                        key={action.text}
                        type="button"
                        className="btn btn-ghost h-9 shrink-0 rounded-full px-4 text-sm font-medium"
                        onClick={() => void act()}
                        disabled={busy}
                        aria-label={`${action.name}: ${suggestion.label}`}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.18, ease: EASE }}
                    >
                        {action.text}
                    </motion.button>
                )}
            </AnimatePresence>
        </motion.section>
    );
}
