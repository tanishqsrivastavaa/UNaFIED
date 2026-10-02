import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Settings2 } from "lucide-react";
import { getPreferences, updatePreferences, type Preferences } from "../../lib/api";
import { cn } from "../../lib/cn";
import { pushSupported, serverKey, subscribe, syncSubscription, unsubscribe } from "../../lib/push";

const EASE = [0.22, 1, 0.36, 1] as const;
const LEADS: [number, string][] = [
    [0, "At the time"],
    [5, "5 minutes before"],
    [10, "10 minutes before"],
    [15, "15 minutes before"],
    [30, "30 minutes before"],
    [60, "1 hour before"],
];

type SaveState = "idle" | "saving" | "saved" | "failed";

/** Rail footer control: when reminders alert you, and how they reach you when the app is closed. */
export default function Settings() {
    const [open, setOpen] = useState(false);
    const [prefs, setPrefs] = useState<Preferences | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    // Push lives in this browser, not in preferences: the server's key, and whether this browser is subscribed.
    const [push, setPush] = useState<{ key: string | null; on: boolean } | null>(null);
    const [save, setSave] = useState<SaveState>("idle");
    const buttonRef = useRef<HTMLButtonElement>(null);
    const id = useId();

    useEffect(() => {
        if (!open) return;
        let live = true;
        getPreferences()
            .then((p) => live && setPrefs(p))
            .catch(() => live && setLoadFailed(true));
        if (pushSupported) {
            Promise.all([serverKey(), syncSubscription()])
                .then(([key, on]) => live && setPush({ key, on }))
                .catch(() => live && setPush({ key: null, on: false }));
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setOpen(false);
            buttonRef.current?.focus();
        };
        window.addEventListener("keydown", onKey);
        return () => {
            live = false;
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const change = async (changes: Partial<Pick<Preferences, "reminder_lead_minutes" | "email_notifications">>) => {
        setSave("saving");
        try {
            setPrefs(await updatePreferences(changes));
            setSave("saved");
        } catch {
            setSave("failed");
        }
    };

    const changePush = async (on: boolean) => {
        if (!push?.key) return;
        setSave("saving");
        try {
            await (on ? subscribe(push.key) : unsubscribe());
            setPush({ key: push.key, on });
            setSave("saved");
        } catch {
            // A refusal is explained under the switch; anything else is worth another try.
            setSave(Notification.permission === "denied" ? "idle" : "failed");
        }
    };

    const toggle = () => {
        setOpen((v) => !v);
        setLoadFailed(false);
        setSave("idle");
    };

    const leads =
        prefs && !LEADS.some(([m]) => m === prefs.reminder_lead_minutes)
            ? [...LEADS, [prefs.reminder_lead_minutes, `${prefs.reminder_lead_minutes} minutes before`] as [number, string]]
            : LEADS;

    const blocked = pushSupported && Notification.permission === "denied";
    const pushReady = !!push?.key && !blocked;
    const pushNote = !pushSupported
        ? "This browser can’t alert you when the app is closed."
        : push && !push.key
          ? "Closed-app alerts aren’t set up on this server yet."
          : blocked
            ? "Notifications are blocked for this site in your browser settings."
            : null;

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={toggle}
                aria-label="Reminder settings"
                title="Reminder settings"
                aria-expanded={open}
                aria-controls={id}
                className={cn("btn btn-quiet btn-icon shrink-0 text-ink-4", open && "bg-fill-2 text-ink")}
            >
                <Settings2 size={16} aria-hidden="true" />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.section
                        id={id}
                        aria-label="Reminder settings"
                        className="absolute inset-x-3 bottom-[60px] z-40 rounded-2xl border border-line-1 bg-coal p-4 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.8)]"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4, transition: { duration: 0.15 } }}
                        transition={{ duration: 0.25, ease: EASE }}
                    >
                        <h2 className="text-sm font-medium text-ink">Reminders</h2>
                        {loadFailed ? (
                            <p role="alert" className="mt-2 text-sm text-ink-2">
                                Your settings didn&rsquo;t load. Close this and try again.
                            </p>
                        ) : !prefs ? (
                            <p role="status" className="mt-2 text-sm text-ink-4">
                                Loading…
                            </p>
                        ) : (
                            <>
                                <label htmlFor={`${id}-lead`} className="mt-3 block text-meta text-ink-3">
                                    Alert me
                                </label>
                                <select
                                    id={`${id}-lead`}
                                    className="field mt-1 h-10 text-base"
                                    value={prefs.reminder_lead_minutes}
                                    onChange={(e) => void change({ reminder_lead_minutes: Number(e.target.value) })}
                                >
                                    {leads.map(([minutes, label]) => (
                                        <option key={minutes} value={minutes}>
                                            {label}
                                        </option>
                                    ))}
                                </select>

                                <label className={cn("mt-3 flex items-center gap-2.5 text-sm text-ink-2", !pushReady && "opacity-60")}>
                                    <input
                                        type="checkbox"
                                        className="size-4 accent-[var(--color-bone)]"
                                        checked={pushReady && !!push?.on}
                                        disabled={!pushReady || save === "saving"}
                                        onChange={(e) => void changePush(e.target.checked)}
                                        aria-describedby={pushNote ? `${id}-push-note` : undefined}
                                    />
                                    Alert me when the app is closed
                                </label>
                                {pushNote && (
                                    <p id={`${id}-push-note`} className="mt-1 pl-[26px] text-meta text-ink-4">
                                        {pushNote}
                                    </p>
                                )}

                                <label className={cn("mt-3 flex items-center gap-2.5 text-sm text-ink-2", !prefs.email_available && "opacity-60")}>
                                    <input
                                        type="checkbox"
                                        className="size-4 accent-[var(--color-bone)]"
                                        checked={prefs.email_notifications}
                                        disabled={!prefs.email_available}
                                        onChange={(e) => void change({ email_notifications: e.target.checked })}
                                        aria-describedby={prefs.email_available ? undefined : `${id}-email-note`}
                                    />
                                    Email me too
                                </label>
                                {!prefs.email_available && (
                                    <p id={`${id}-email-note`} className="mt-1 pl-[26px] text-meta text-ink-4">
                                        Email isn&rsquo;t set up on this server yet.
                                    </p>
                                )}

                                <p role="status" className="mt-3 h-4 text-meta text-ink-4">
                                    {save === "saving" ? "Saving…" : save === "saved" ? "Saved" : save === "failed" ? "That didn't save. Try again." : ""}
                                </p>
                            </>
                        )}
                    </motion.section>
                )}
            </AnimatePresence>
        </>
    );
}
