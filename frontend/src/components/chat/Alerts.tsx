import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { when } from "../../lib/time";
import { useReminderStore } from "../../stores/reminderStore";
import Presence from "../ui/Presence";
import { EASE } from "../../lib/motion";
// The server decides when a reminder is due and pushes it on the app-wide socket;
// polling only catches what a dropped socket missed. Closed tabs get Web Push or email.
const POLL_MS = 60_000;
const CHECK_MS = 15_000;

/** Keeps reminders fresh, and shows an alert as each one comes due: at the foot of the rail, or the top of a phone screen. */
export default function Alerts() {
    const alerts = useReminderStore((s) => s.alerts);
    const reminders = useReminderStore((s) => s.reminders);
    const load = useReminderStore((s) => s.load);
    const check = useReminderStore((s) => s.check);
    const dismissAlert = useReminderStore((s) => s.dismissAlert);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        void load();
        const poll = window.setInterval(() => void load(), POLL_MS);
        const tick = window.setInterval(() => {
            setNow(Date.now());
            check(Date.now());
        }, CHECK_MS);
        return () => {
            window.clearInterval(poll);
            window.clearInterval(tick);
        };
    }, [load, check]);

    // A fresh list may hold one that is already due.
    useEffect(() => check(Date.now()), [reminders, check]);

    return (
        <div aria-live="polite" className="pointer-events-none fixed inset-x-3 top-3 z-30 flex flex-col gap-2 md:inset-x-auto md:bottom-16 md:left-3 md:top-auto md:w-[256px]">
            <AnimatePresence initial={false}>
                {alerts.map((a) => (
                    <motion.div
                        key={a.id}
                        layout="position"
                        role="status"
                        className="pop pointer-events-auto flex items-start gap-3 py-3.5 pl-4 pr-2"
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, transition: { duration: 0.18, ease: EASE } }}
                        transition={{ duration: 0.3, ease: EASE }}
                    >
                        <Presence mode="listen" className="mt-2" />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-body font-medium text-ink">{a.title}</p>
                            <p className="tnum text-meta text-ink-3">{when(a.due_at, now)}</p>
                            {a.conversation_id && (
                                <Link
                                    to={`/chat/${a.conversation_id}`}
                                    onClick={() => dismissAlert(a.id)}
                                    className="mt-1.5 inline-block text-meta font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
                                >
                                    Open the chat
                                </Link>
                            )}
                        </div>
                        <button
                            type="button"
                            className="btn btn-quiet btn-icon size-9 shrink-0 text-ink-3"
                            onClick={() => dismissAlert(a.id)}
                            aria-label={`Dismiss reminder: ${a.title}`}
                        >
                            <X size={15} aria-hidden="true" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
