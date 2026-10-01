import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, X } from "lucide-react";
import type { Reminder } from "../../lib/api";
import { serverDate, when } from "../../lib/time";
import { cn } from "../../lib/cn";
import { useReminderStore } from "../../stores/reminderStore";

/** A reminder stays on the list this long after its time, then drops off. */
const KEEP_MS = 60 * 60_000;

function canNotify() {
    return "Notification" in window && Notification.permission === "default";
}

/** Upcoming plans in the rail. Hidden entirely while there are none. */
export default function Reminders() {
    const reminders = useReminderStore((s) => s.reminders);
    const setStatus = useReminderStore((s) => s.setStatus);
    const [now, setNow] = useState(() => Date.now());
    const [askable, setAskable] = useState(canNotify);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    const upcoming = reminders.filter(
        (r) => (r.status === "confirmed" || r.status === "proposed") && serverDate(r.due_at).getTime() > now - KEEP_MS,
    );
    if (upcoming.length === 0) return null;

    const change = async (reminder: Reminder, status: "confirmed" | "dismissed") => {
        setBusyId(reminder.id);
        setFailed(false);
        try {
            await setStatus(reminder.id, status);
        } catch {
            setFailed(true);
        } finally {
            setBusyId(null);
        }
    };

    const askToNotify = async () => {
        await Notification.requestPermission();
        setAskable(canNotify());
    };

    return (
        <section aria-labelledby="reminders-heading" className="mt-4 shrink-0 px-3">
            <div className="flex h-8 items-center justify-between pl-3">
                <h2 id="reminders-heading" className="text-meta font-medium text-ink-4">
                    Reminders
                </h2>
                {askable && (
                    <button
                        type="button"
                        className="btn btn-quiet h-8 gap-1.5 rounded-[8px] px-2 text-meta text-ink-4"
                        onClick={() => void askToNotify()}
                        title="Get alerts even when this tab is in the background"
                    >
                        <Bell size={13} aria-hidden="true" />
                        Turn on alerts
                    </button>
                )}
            </div>

            <ul className="max-h-56 space-y-px overflow-y-auto overscroll-contain">
                {upcoming.map((r) => {
                    const waiting = r.status === "proposed";
                    const busy = busyId === r.id;
                    return (
                        <li key={r.id} className="group relative">
                            <Link
                                to={r.conversation_id ? `/chat/${r.conversation_id}` : "/chat"}
                                className="relative flex min-h-12 items-center gap-3 rounded-[10px] py-1.5 pl-3 pr-3 transition-colors duration-200 hover:bg-fill-1 group-focus-within:pr-[84px] group-hover:pr-[84px] pointer-coarse:pr-[84px]"
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        "size-1.5 shrink-0 rounded-full",
                                        waiting ? "ring-1 ring-ink-4" : "bg-ink-2",
                                    )}
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-base text-ink-2">{r.title}</span>
                                    <span className="tnum block truncate text-micro text-ink-4">
                                        {when(r.due_at, now)}
                                        {waiting && " · waiting for a yes"}
                                    </span>
                                </span>
                            </Link>
                            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
                                {waiting && (
                                    <button
                                        type="button"
                                        className="btn btn-quiet btn-icon size-9 rounded-[8px] text-ink-4"
                                        onClick={() => void change(r, "confirmed")}
                                        disabled={busy}
                                        aria-label={`Keep ${r.title} without waiting`}
                                        title="Keep it without waiting"
                                    >
                                        <Check size={15} aria-hidden="true" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="btn btn-quiet btn-icon size-9 rounded-[8px] text-ink-4"
                                    onClick={() => void change(r, "dismissed")}
                                    disabled={busy}
                                    aria-label={`Remove ${r.title}`}
                                    title="Remove"
                                >
                                    <X size={15} aria-hidden="true" />
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {failed && (
                <p role="alert" className="mt-1 px-3 text-meta text-ink-2">
                    That reminder didn&rsquo;t update. Try again.
                </p>
            )}
        </section>
    );
}
