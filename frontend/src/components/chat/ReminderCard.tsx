import { useState } from "react";
import { motion } from "framer-motion";
import type { Message } from "../../lib/api";
import { serverDate, when } from "../../lib/time";
import { useReminderStore } from "../../stores/reminderStore";
import Presence from "../ui/Presence";

const EASE = [0.22, 1, 0.36, 1] as const;

type Suggestion = NonNullable<Message["suggestion"]>;

/**
 * What the assistant posts once people agree on a time. Each reader has their
 * own reminder for the plan, so Undo only takes it off their list.
 */
export default function ReminderCard({ suggestion }: { suggestion: Suggestion }) {
    const plan = String(suggestion.parameters.plan ?? "");
    const dueAt = String(suggestion.parameters.due_at ?? "");
    const mine = useReminderStore((s) => s.reminders.find((r) => r.message_id === plan));
    const loaded = useReminderStore((s) => s.loaded);
    const setStatus = useReminderStore((s) => s.setStatus);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const [now] = useState(() => Date.now());

    const past = dueAt !== "" && serverDate(dueAt).getTime() < now;
    const state = !loaded ? null : !mine ? "changed" : mine.status === "dismissed" ? "removed" : "set";

    const toggle = async () => {
        if (!mine) return;
        setBusy(true);
        setFailed(false);
        try {
            await setStatus(mine.id, state === "removed" ? "confirmed" : "dismissed");
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
                    {state === "removed" ? "Removed for you" : state === "changed" ? "Plan changed since" : "Reminder"}
                </p>
                <p className="mt-2 truncate text-body font-medium tracking-[-0.01em] text-ink">{suggestion.label}</p>
                {dueAt && (
                    <time dateTime={dueAt} className="tnum text-meta text-ink-3">
                        {when(dueAt, now)}
                    </time>
                )}
                {failed && (
                    <p role="alert" className="mt-1 text-meta text-ink-2">
                        That didn&rsquo;t save. Try again.
                    </p>
                )}
            </div>
            {mine && !past && (state === "set" || state === "removed") && (
                <button
                    type="button"
                    className="btn btn-quiet h-10 shrink-0 px-3.5 text-sm font-medium"
                    onClick={() => void toggle()}
                    disabled={busy}
                    aria-label={state === "removed" ? `Restore reminder: ${suggestion.label}` : `Undo reminder: ${suggestion.label}`}
                >
                    {state === "removed" ? "Restore" : "Undo"}
                </button>
            )}
        </motion.section>
    );
}
