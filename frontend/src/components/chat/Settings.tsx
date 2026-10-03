import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Monitor, Moon, Settings2, Sun } from "lucide-react";
import { getPreferences, updatePreferences, type Preferences } from "../../lib/api";
import { cn } from "../../lib/cn";
import { EASE, pop } from "../../lib/motion";
import { pushSupported, serverKey, subscribe, syncSubscription, unsubscribe } from "../../lib/push";
import { setTheme, useTheme, type ThemeChoice } from "../../lib/theme";

const THEMES: [ThemeChoice, string, typeof Sun][] = [
    ["system", "System", Monitor],
    ["light", "Light", Sun],
    ["dark", "Dark", Moon],
];
const LEADS: [number, string][] = [
    [0, "At the time"],
    [5, "5 minutes before"],
    [10, "10 minutes before"],
    [15, "15 minutes before"],
    [30, "30 minutes before"],
    [60, "1 hour before"],
];

type SaveState = "idle" | "saving" | "saved" | "failed";

/** How the theme is chosen: follow the system, or keep one. Native radios, so arrow keys work. */
function Appearance() {
    const { choice } = useTheme();
    return (
        <fieldset>
            <legend className="text-sm font-medium text-ink">Appearance</legend>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-[12px] bg-fill-2 p-1">
                {THEMES.map(([value, label, Icon]) => (
                    <label
                        key={value}
                        className={cn(
                            "relative flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] text-sm transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-ring",
                            choice === value ? "text-ink" : "text-ink-3 hover:text-ink",
                        )}
                    >
                        {choice === value && (
                            <motion.span
                                layoutId="theme-choice"
                                aria-hidden="true"
                                className="absolute inset-0 rounded-[9px] bg-panel shadow-pill"
                                transition={{ duration: 0.3, ease: EASE }}
                            />
                        )}
                        <input
                            type="radio"
                            name="theme"
                            value={value}
                            checked={choice === value}
                            onChange={() => setTheme(value)}
                            className="sr-only"
                        />
                        <Icon size={14} aria-hidden="true" className="relative" />
                        <span className="relative">{label}</span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

/** Rail footer control: the theme, when reminders alert you, and how they reach you when the app is closed. */
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
                aria-label="Settings"
                title="Settings"
                aria-expanded={open}
                aria-controls={id}
                className={cn("btn btn-quiet btn-icon shrink-0 text-ink-3", open && "bg-fill-2 text-ink")}
            >
                <Settings2 size={16} aria-hidden="true" />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.section
                        id={id}
                        aria-label="Settings"
                        className="pop absolute inset-x-3 bottom-[60px] z-40 origin-bottom p-4 md:inset-x-1 md:bottom-[52px]"
                        {...pop}
                        initial={{ opacity: 0, scale: 0.97, y: 4 }}
                    >
                        <Appearance />
                        <h2 className="mt-5 border-t border-line-1 pt-4 text-sm font-medium text-ink">Reminders</h2>
                        {loadFailed ? (
                            <p role="alert" className="mt-2 text-sm text-ink-2">
                                Your settings didn&rsquo;t load. Close this and try again.
                            </p>
                        ) : !prefs ? (
                            <div role="status" className="mt-3 space-y-2.5">
                                <span className="sr-only">Loading…</span>
                                <span aria-hidden="true" className="skeleton block h-2.5 w-1/3 rounded-full" />
                                <span aria-hidden="true" className="skeleton block h-10 rounded-[12px]" />
                                <span aria-hidden="true" className="skeleton block h-2.5 w-2/3 rounded-full" />
                            </div>
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
                                        className="size-4 accent-[var(--ink)]"
                                        checked={pushReady && !!push?.on}
                                        disabled={!pushReady || save === "saving"}
                                        onChange={(e) => void changePush(e.target.checked)}
                                        aria-describedby={pushNote ? `${id}-push-note` : undefined}
                                    />
                                    Alert me when the app is closed
                                </label>
                                {pushNote && (
                                    <p id={`${id}-push-note`} className="mt-1 pl-[26px] text-meta text-ink-3">
                                        {pushNote}
                                    </p>
                                )}

                                <label className={cn("mt-3 flex items-center gap-2.5 text-sm text-ink-2", !prefs.email_available && "opacity-60")}>
                                    <input
                                        type="checkbox"
                                        className="size-4 accent-[var(--ink)]"
                                        checked={prefs.email_notifications}
                                        disabled={!prefs.email_available}
                                        onChange={(e) => void change({ email_notifications: e.target.checked })}
                                        aria-describedby={prefs.email_available ? undefined : `${id}-email-note`}
                                    />
                                    Email me too
                                </label>
                                {!prefs.email_available && (
                                    <p id={`${id}-email-note`} className="mt-1 pl-[26px] text-meta text-ink-3">
                                        Email isn&rsquo;t set up on this server yet.
                                    </p>
                                )}

                                <p role="status" className="mt-3 h-4 text-meta text-ink-3">
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
