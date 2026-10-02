import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AtSign } from "lucide-react";
import { useChatStore } from "../../stores/chatStore";
import { plainError } from "../../lib/errors";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Rail control: opens your chat with one person by email, starting it if there is none. */
export default function DirectChat() {
    const direct = useChatStore((s) => s.direct);
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const id = useId();

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    const close = () => {
        setOpen(false);
        setError(null);
        buttonRef.current?.focus();
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        const value = email.trim();
        if (!value || busy) return;
        setBusy(true);
        setError(null);
        try {
            const convo = await direct(value);
            setEmail("");
            setOpen(false);
            navigate(`/chat/${convo.id}`);
        } catch (err) {
            setError(plainError(err, "That chat couldn't be opened. Try again."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => (open ? close() : setOpen(true))}
                aria-expanded={open}
                aria-controls={id}
                className="btn btn-quiet h-10 w-full justify-start gap-2.5 rounded-[10px] px-3 font-medium text-ink-2"
            >
                <AtSign size={16} aria-hidden="true" />
                <span className="flex-1 text-left">Message someone</span>
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.form
                        id={id}
                        onSubmit={submit}
                        onKeyDown={(e) => e.key === "Escape" && close()}
                        aria-label="Message someone by email"
                        className="overflow-hidden"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
                        transition={{ duration: 0.25, ease: EASE }}
                    >
                        <div className="px-1 pb-2 pt-1">
                            <label htmlFor={`${id}-email`} className="sr-only">
                                Their email
                            </label>
                            <input
                                ref={inputRef}
                                id={`${id}-email`}
                                type="email"
                                autoComplete="off"
                                spellCheck={false}
                                className="field h-10 text-base"
                                placeholder="Their email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                aria-invalid={error ? true : undefined}
                                aria-describedby={error ? `${id}-error` : undefined}
                            />
                            {error && (
                                <p id={`${id}-error`} role="alert" className="mt-2 flex items-start gap-2 text-sm text-ink-2">
                                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                                    {error}
                                </p>
                            )}
                            <button type="submit" className="btn btn-primary mt-2 h-9 w-full text-sm" disabled={!email.trim() || busy}>
                                {busy ? "Opening…" : "Open chat"}
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>
        </div>
    );
}
