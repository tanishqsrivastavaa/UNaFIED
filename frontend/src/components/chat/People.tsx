import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, LogOut, UserMinus, Users, X } from "lucide-react";
import type { Participant } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import { plainError } from "../../lib/errors";
import { cn } from "../../lib/cn";

const EASE = [0.22, 1, 0.36, 1] as const;
const DISARM_MS = 3000;
const LEAVE = "leave";
const NO_PARTICIPANTS: Participant[] = [];

/**
 * Header control for who's here: the members, adding someone by email, removing
 * someone (owner only) and leaving. People's actions, so never sage.
 */
export default function People({ conversationId }: { conversationId: string }) {
    const participants = useChatStore((s) => s.participants[conversationId] ?? NO_PARTICIPANTS);
    const invite = useChatStore((s) => s.invite);
    const leave = useChatStore((s) => s.leave);
    const removeMember = useChatStore((s) => s.removeMember);
    const me = useAuthStore((s) => s.user?.id);
    const navigate = useNavigate();

    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [adding, setAdding] = useState(false);
    /** The person (or LEAVE) whose button asked once and waits for a second press. */
    const [armed, setArmed] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const panelRef = useRef<HTMLElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelId = useId();

    const members = participants.filter((p) => p.is_active);
    const isOwner = members.some((p) => p.user_id === me && p.role === "owner");
    // The last one here deletes the conversation instead
    const canLeave = members.length > 1 && members.some((p) => p.user_id === me);

    /** Closing unmounts whatever had focus, so hand it back to the button that opened it. */
    const close = () => {
        setOpen(false);
        buttonRef.current?.focus();
    };

    useEffect(() => {
        if (!open) return;
        panelRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setOpen(false);
            buttonRef.current?.focus();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    // Removing and leaving ask twice; the second ask expires on its own.
    useEffect(() => {
        if (!armed) return;
        const timer = window.setTimeout(() => setArmed(null), DISARM_MS);
        return () => window.clearTimeout(timer);
    }, [armed]);

    const toggle = () => {
        setOpen((v) => !v);
        setArmed(null);
        setError(null);
    };

    const add = async (e: FormEvent) => {
        e.preventDefault();
        const value = email.trim();
        if (!value || adding) return;
        setAdding(true);
        setError(null);
        try {
            await invite(conversationId, value);
            setEmail("");
        } catch (err) {
            setError(plainError(err, "That person couldn't be added. Try again."));
        } finally {
            setAdding(false);
        }
    };

    const remove = async (person: Participant) => {
        if (armed !== person.user_id) {
            setArmed(person.user_id);
            return;
        }
        setArmed(null);
        setBusy(person.user_id);
        setError(null);
        try {
            await removeMember(conversationId, person.user_id);
            panelRef.current?.focus(); // their row, and the focused button, are gone
        } catch (err) {
            setError(plainError(err, "That person wasn't removed. Try again."));
        } finally {
            setBusy(null);
        }
    };

    const leaveHere = async () => {
        if (armed !== LEAVE) {
            setArmed(LEAVE);
            return;
        }
        setArmed(null);
        setBusy(LEAVE);
        setError(null);
        try {
            await leave(conversationId);
            navigate("/chat", { replace: true });
        } catch (err) {
            setError(plainError(err, "You're still in this conversation. Try again."));
            setBusy(null);
        }
    };

    return (
        <div className="relative shrink-0">
            <button
                ref={buttonRef}
                type="button"
                className={cn("btn btn-quiet btn-icon text-ink-4", open && "bg-fill-2 text-ink")}
                title="People"
                aria-label="People"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={toggle}
            >
                <Users size={17} aria-hidden="true" />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.section
                        ref={panelRef}
                        id={panelId}
                        tabIndex={-1}
                        aria-label="People in this conversation"
                        className="absolute right-0 top-12 z-20 w-[340px] rounded-2xl border border-line-1 bg-coal p-4 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.8)] outline-none max-sm:fixed max-sm:inset-x-4 max-sm:top-[68px] max-sm:w-auto"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                        transition={{ duration: 0.25, ease: EASE }}
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-medium text-ink">People</h2>
                            <button type="button" className="btn btn-quiet btn-icon -mr-2" aria-label="Close" onClick={close}>
                                <X size={16} aria-hidden="true" />
                            </button>
                        </div>

                        <ul className="-mx-2 mt-1 max-h-[200px] space-y-px overflow-y-auto">
                            {members.map((person) => {
                                const you = person.user_id === me;
                                const owner = person.role === "owner";
                                const isArmed = armed === person.user_id;
                                const tag = you ? (owner ? "You · owner" : "You") : owner ? "Owner" : "";
                                return (
                                    <li key={person.user_id} className="flex h-10 items-center gap-2 pl-2">
                                        <span className="min-w-0 flex-1 truncate text-sm text-ink-2" title={person.email}>
                                            {person.email}
                                        </span>
                                        {tag && <span className="shrink-0 pr-2 text-meta text-ink-4">{tag}</span>}
                                        {isOwner && !you && (
                                            <button
                                                type="button"
                                                onClick={() => void remove(person)}
                                                onBlur={() => isArmed && setArmed(null)}
                                                disabled={busy !== null}
                                                aria-label={isArmed ? `Confirm remove ${person.email}` : `Remove ${person.email}`}
                                                aria-busy={busy === person.user_id}
                                                title={isArmed ? undefined : "Remove"}
                                                className={cn(
                                                    "btn btn-quiet h-10 shrink-0 rounded-[10px]",
                                                    isArmed ? "bg-fill-3 px-3 text-sm text-ink" : "w-10 px-0 text-ink-4",
                                                )}
                                            >
                                                {isArmed ? "Remove" : <UserMinus size={15} aria-hidden="true" />}
                                            </button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>

                        <form onSubmit={add} className="mt-3 border-t border-line-1 pt-3">
                            <label htmlFor={`${panelId}-email`} className="text-meta text-ink-3">
                                Add someone by email
                            </label>
                            <div className="mt-1 flex gap-2">
                                <input
                                    id={`${panelId}-email`}
                                    type="email"
                                    autoComplete="off"
                                    spellCheck={false}
                                    className="field h-10 min-w-0 flex-1 text-base"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                                <button type="submit" className="btn btn-ghost h-10 shrink-0 px-3.5" disabled={!email.trim() || adding}>
                                    {adding ? "Adding…" : "Add"}
                                </button>
                            </div>
                        </form>

                        {error && (
                            <p role="alert" className="mt-2.5 flex items-start gap-2 text-sm text-ink-2">
                                <AlertCircle size={15} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                                {error}
                            </p>
                        )}

                        {canLeave && (
                            <div className="mt-3 border-t border-line-1 pt-3">
                                <button
                                    type="button"
                                    onClick={() => void leaveHere()}
                                    onBlur={() => armed === LEAVE && setArmed(null)}
                                    disabled={busy !== null}
                                    aria-busy={busy === LEAVE}
                                    className={cn(
                                        "btn btn-quiet -mx-2 h-10 w-[calc(100%+16px)] justify-start gap-2.5 rounded-[10px] px-2 text-sm",
                                        armed === LEAVE ? "bg-fill-3 text-ink" : "text-ink-3",
                                    )}
                                >
                                    <LogOut size={15} aria-hidden="true" />
                                    {busy === LEAVE ? "Leaving…" : armed === LEAVE ? "Press again to leave" : "Leave conversation"}
                                </button>
                            </div>
                        )}
                    </motion.section>
                )}
            </AnimatePresence>
        </div>
    );
}
