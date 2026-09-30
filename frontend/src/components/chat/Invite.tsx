import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, UserPlus, X } from "lucide-react";
import { useChatStore } from "../../stores/chatStore";
import { plainError } from "../../lib/errors";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Header control that adds someone to the conversation by email. Adding is a human action, so it stays parchment. */
export default function Invite({ conversationId }: { conversationId: string }) {
    const invite = useChatStore((s) => s.invite);
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelId = useId();

    /** Closing unmounts the focused field, so hand focus back to the button that opened it. */
    const close = () => {
        setOpen(false);
        buttonRef.current?.focus();
    };

    useEffect(() => {
        if (!open) return;
        inputRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setOpen(false);
            buttonRef.current?.focus();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    const toggle = () => {
        setOpen((v) => !v);
        setError(null);
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        const value = email.trim();
        if (!value || busy) return;
        setBusy(true);
        setError(null);
        try {
            await invite(conversationId, value);
            setEmail("");
            close();
        } catch (err) {
            setError(plainError(err, "That person couldn't be added. Try again."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="relative shrink-0">
            <button
                ref={buttonRef}
                type="button"
                className="btn btn-quiet btn-icon"
                aria-label="Add someone"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={toggle}
            >
                <UserPlus size={18} aria-hidden="true" />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.form
                        id={panelId}
                        onSubmit={submit}
                        aria-label="Add someone to this conversation"
                        className="veil absolute right-0 top-12 z-20 w-[340px] rounded-lg p-4 max-sm:fixed max-sm:inset-x-5 max-sm:top-[68px] max-sm:w-auto"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                        transition={{ duration: 0.3, ease: EASE }}
                    >
                        <div className="flex items-center justify-between">
                            <label htmlFor={`${panelId}-email`} className="text-sm font-semibold text-ink">
                                Add someone by email
                            </label>
                            <button
                                type="button"
                                className="btn btn-quiet btn-icon -mr-2"
                                aria-label="Close"
                                onClick={close}
                            >
                                <X size={16} aria-hidden="true" />
                            </button>
                        </div>

                        <input
                            ref={inputRef}
                            id={`${panelId}-email`}
                            type="email"
                            autoComplete="off"
                            spellCheck={false}
                            className="field mt-1"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? `${panelId}-error` : undefined}
                        />

                        {error && (
                            <p id={`${panelId}-error`} role="alert" className="mt-2 flex items-start gap-2 text-sm text-ink-2">
                                <AlertCircle size={15} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                                {error}
                            </p>
                        )}

                        <button type="submit" className="btn btn-primary mt-3 w-full" disabled={!email.trim() || busy}>
                            {busy ? "Adding…" : "Add to conversation"}
                        </button>
                    </motion.form>
                )}
            </AnimatePresence>
        </div>
    );
}
