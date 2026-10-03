import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AtSign } from "lucide-react";
import { useChatStore } from "../../stores/chatStore";
import { plainError } from "../../lib/errors";
import { cn } from "../../lib/cn";
import { pop, rise } from "../../lib/motion";

/** Rail control: opens your chat with one person by email, starting it if there is none. */
export default function DirectChat() {
    const direct = useChatStore((s) => s.direct);
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const id = useId();

    useEffect(() => {
        if (!open) return;
        inputRef.current?.focus();
        // It floats over the list, so a press anywhere else puts it away.
        const onDown = (e: PointerEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) {
                setOpen(false);
                setError(null);
            }
        };
        document.addEventListener("pointerdown", onDown);
        return () => document.removeEventListener("pointerdown", onDown);
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
        <div ref={rootRef} className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => (open ? close() : setOpen(true))}
                aria-expanded={open}
                aria-controls={id}
                className={cn(
                    "btn btn-quiet h-10 w-full justify-start gap-2.5 rounded-[12px] px-3 font-medium text-ink-2 hover:bg-hover-canvas",
                    open && "bg-hover-canvas text-ink",
                )}
            >
                <AtSign size={16} aria-hidden="true" />
                <span className="flex-1 text-left">Message someone</span>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.form
                        id={id}
                        onSubmit={submit}
                        onKeyDown={(e) => e.key === "Escape" && close()}
                        aria-label="Message someone by email"
                        className="pop absolute inset-x-0 top-11 z-30 origin-top p-2"
                        {...pop}
                    >
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
                        <AnimatePresence>
                            {error && (
                                <motion.p id={`${id}-error`} role="alert" className="mt-2 flex items-start gap-2 px-1 text-sm text-ink-2" {...rise}>
                                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                                    {error}
                                </motion.p>
                            )}
                        </AnimatePresence>
                        <button type="submit" className="btn btn-primary mt-2 h-9 w-full text-sm" disabled={!email.trim() || busy}>
                            {busy ? "Opening…" : "Open chat"}
                        </button>
                    </motion.form>
                )}
            </AnimatePresence>
        </div>
    );
}
