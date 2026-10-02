import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { AlertCircle, Bell, Check, Pencil, X } from "lucide-react";
import type { Reminder, ReminderChanges } from "../../lib/api";
import { localInput, serverDate, when } from "../../lib/time";
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
    const update = useReminderStore((s) => s.update);
    const [now, setNow] = useState(() => Date.now());
    const [askable, setAskable] = useState(canNotify);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const editButtons = useRef(new Map<string, HTMLButtonElement>());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    const upcoming = reminders.filter(
        (r) => r.status !== "dismissed" && serverDate(r.due_at).getTime() > now - KEEP_MS,
    );
    if (upcoming.length === 0) return null;

    const change = async (reminder: Reminder, status: "confirmed" | "dismissed") => {
        setBusyId(reminder.id);
        setFailed(false);
        try {
            await update(reminder.id, { status });
        } catch {
            setFailed(true);
        } finally {
            setBusyId(null);
        }
    };

    /**
     * The form takes the row's place, so put the row back now and hand focus to its Edit button.
     * A save can land after another row's form opened; leave that form and its focus alone.
     */
    const closeEdit = (id: string) => {
        flushSync(() => setEditingId((current) => (current === id ? null : current)));
        if (document.activeElement === document.body) editButtons.current.get(id)?.focus();
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
                    if (r.id === editingId) {
                        return (
                            <li key={r.id}>
                                <EditForm reminder={r} onClose={() => closeEdit(r.id)} />
                            </li>
                        );
                    }
                    const waiting = r.status === "proposed";
                    const busy = busyId === r.id;
                    return (
                        <li key={r.id} className="group relative">
                            <Link
                                to={r.conversation_id ? `/chat/${r.conversation_id}` : "/chat"}
                                className={cn(
                                    "relative flex min-h-12 items-center gap-3 rounded-[10px] py-1.5 pl-3 pr-3 transition-colors duration-200 hover:bg-fill-1",
                                    waiting
                                        ? "group-focus-within:pr-[120px] group-hover:pr-[120px] pointer-coarse:pr-[120px]"
                                        : "group-focus-within:pr-[84px] group-hover:pr-[84px] pointer-coarse:pr-[84px]",
                                )}
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
                                <button
                                    ref={(el) => {
                                        if (el) editButtons.current.set(r.id, el);
                                        else editButtons.current.delete(r.id);
                                    }}
                                    type="button"
                                    className="btn btn-quiet btn-icon size-9 rounded-[8px] text-ink-4"
                                    onClick={() => setEditingId(r.id)}
                                    disabled={busy}
                                    aria-label={`Edit ${r.title}`}
                                    title="Edit"
                                >
                                    <Pencil size={14} aria-hidden="true" />
                                </button>
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

/**
 * Edits one reminder in place of its row. Sends only what changed: any new time
 * re-arms a reminder that already alerted, so an untouched time must not be sent.
 */
function EditForm({ reminder, onClose }: { reminder: Reminder; onClose: () => void }) {
    const update = useReminderStore((s) => s.update);
    // What the form opened with; a list refresh mid-edit must not count as the person's change.
    const [initial] = useState(() => ({ title: reminder.title, time: localInput(reminder.due_at) }));
    const [title, setTitle] = useState(initial.title);
    const [time, setTime] = useState(initial.time);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<{ field?: "title" | "time"; text: string } | null>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const id = useId();

    // The list is height-capped; focusing the title alone can leave Save scrolled out of sight.
    useEffect(() => formRef.current?.scrollIntoView({ block: "nearest" }), []);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (busy) return;
        const name = title.trim();
        const at = new Date(time).getTime(); // a datetime-local value parses as local time
        const moved = time !== initial.time;
        const fail = (field: "title" | "time", text: string) => setError({ field, text });
        if (!name) return fail("title", "Give it a title.");
        if (Number.isNaN(at)) return fail("time", "Pick a time.");
        if (moved && at <= Date.now()) return fail("time", "That time has already passed.");

        const changes: ReminderChanges = {};
        if (name !== initial.title) changes.title = name;
        if (moved) changes.due_at = new Date(at).toISOString();
        if (!changes.title && !changes.due_at) {
            onClose();
            return;
        }

        setBusy(true);
        setError(null);
        try {
            await update(reminder.id, changes);
            onClose();
        } catch {
            setError({ text: "That didn’t save. Try again." });
            setBusy(false);
        }
    };

    const describedBy = error ? `${id}-error` : undefined;

    return (
        <form
            ref={formRef}
            onSubmit={submit}
            onKeyDown={(e) => e.key === "Escape" && !busy && onClose()}
            aria-label={`Edit ${reminder.title}`}
            className="space-y-2 rounded-[10px] bg-fill-1 p-2"
        >
            <label htmlFor={`${id}-title`} className="sr-only">
                Title
            </label>
            <input
                id={`${id}-title`}
                autoFocus
                autoComplete="off"
                maxLength={200}
                className="field h-9 px-3 text-base"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-invalid={error?.field === "title" ? true : undefined}
                aria-describedby={describedBy}
            />
            <label htmlFor={`${id}-time`} className="sr-only">
                Time
            </label>
            <input
                id={`${id}-time`}
                type="datetime-local"
                className="field tnum h-9 px-3 text-base"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                aria-invalid={error?.field === "time" ? true : undefined}
                aria-describedby={describedBy}
            />
            {error && (
                <p id={`${id}-error`} role="alert" className="flex items-start gap-2 px-1 text-meta text-ink-2">
                    <AlertCircle size={14} className="mt-px shrink-0 text-ink-3" aria-hidden="true" />
                    {error.text}
                </p>
            )}
            <div className="flex justify-end gap-1">
                <button type="button" className="btn btn-quiet h-8 rounded-[8px] px-3 text-sm" onClick={onClose} disabled={busy}>
                    Cancel
                </button>
                <button type="submit" className="btn btn-primary h-8 rounded-[8px] px-3 text-sm" disabled={busy}>
                    {busy ? "Saving…" : "Save"}
                </button>
            </div>
        </form>
    );
}
