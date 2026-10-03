import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { cn } from "../../lib/cn";
import { rise } from "../../lib/motion";
import Kbd from "../ui/Kbd";

const MAX_HEIGHT = 168;
/** While composing, "typing" goes out again this often; the other side forgets a typer after ~5s. */
const HEARTBEAT_MS = 2500;
/** This long without a keystroke counts as having stopped. */
const IDLE_MS = 4000;

interface Props {
    /** Resolves false when the message didn't go out, so the text comes back. */
    onSend: (text: string) => Promise<boolean>;
    /** A reply is in flight: typing is fine, sending waits. */
    busy: boolean;
    onTyping?: (isTyping: boolean) => void;
}

export default function Composer({ onSend, busy, onTyping }: Props) {
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const typing = useRef({ on: false, last: 0, idle: 0 });
    const armed = value.trim().length > 0 && !busy;

    const stopTyping = () => {
        const t = typing.current;
        window.clearTimeout(t.idle);
        if (!t.on) return;
        t.on = false;
        onTyping?.(false);
    };

    /** Say "typing" when it starts and every few seconds while it goes on; "stopped" once it doesn't. */
    const noteTyping = (text: string) => {
        if (!text.trim()) return stopTyping();
        const t = typing.current;
        const now = Date.now();
        if (!t.on || now - t.last >= HEARTBEAT_MS) {
            t.on = true;
            t.last = now;
            onTyping?.(true);
        }
        window.clearTimeout(t.idle);
        t.idle = window.setTimeout(stopTyping, IDLE_MS);
    };

    // Leaving the thread mid-sentence. A layout cleanup runs before the thread's
    // passive cleanup closes the socket, so this last "stopped" still goes out.
    const stopRef = useRef(stopTyping);
    useEffect(() => {
        stopRef.current = stopTyping;
    });
    useLayoutEffect(() => () => stopRef.current(), []);

    // Grow with the text up to a cap. JS rather than `field-sizing`, which
    // Firefox and older Safari ignore.
    useLayoutEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    }, [value]);

    useEffect(() => {
        if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });

        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
            const target = e.target as HTMLElement | null;
            if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
            e.preventDefault();
            inputRef.current?.focus();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const submit = async () => {
        const text = value.trim();
        if (!text || busy) return;
        stopTyping();
        setValue("");
        const sent = await onSend(text);
        if (!sent) setValue((current) => (current === "" ? text : current));
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        void submit();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
        }
    };

    return (
        <div className="mx-auto w-full max-w-[760px] px-3 pb-3 sm:px-6 sm:pb-5">
            <form
                onSubmit={handleSubmit}
                className="group/composer relative flex items-end gap-2 rounded-[22px] bg-field p-1.5 ring-1 ring-line-1 transition-shadow duration-150 ring-inset focus-within:ring-line-3"
            >
                <label htmlFor="composer" className="sr-only">
                    Message
                </label>
                <textarea
                    id="composer"
                    ref={inputRef}
                    rows={1}
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        noteTyping(e.target.value);
                    }}
                    onBlur={stopTyping}
                    onKeyDown={handleKeyDown}
                    placeholder="Write a message…"
                    maxLength={4000}
                    aria-describedby="composer-hint"
                    className="min-h-10 flex-1 resize-none bg-transparent px-3.5 py-2 text-body text-ink placeholder:text-ink-4 focus:outline-none"
                    style={{ maxHeight: MAX_HEIGHT }}
                />
                {!value && (
                    <Kbd className="pointer-events-none absolute bottom-4 right-[60px] bg-transparent text-ink-4 transition-opacity duration-150 group-focus-within/composer:opacity-0 pointer-coarse:hidden">
                        <span aria-hidden="true">/</span>
                    </Kbd>
                )}
                <button
                    type="submit"
                    disabled={!armed}
                    aria-label="Send message"
                    className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-200 ease-out active:scale-90 disabled:cursor-not-allowed",
                        armed ? "scale-100 bg-ink text-panel" : "scale-90 bg-transparent text-ink-3",
                    )}
                >
                    <ArrowUp size={18} strokeWidth={2} aria-hidden="true" />
                </button>
            </form>

            <p id="composer-hint" className="mt-2 flex h-5 items-center justify-center text-meta text-ink-3">
                <AnimatePresence mode="wait" initial={false}>
                    {busy ? (
                        <motion.span key="busy" {...rise}>
                            You can send once UNaFIED has replied.
                        </motion.span>
                    ) : (
                        <span key="idle" className="sr-only">
                            Enter sends, Shift+Enter adds a new line, and the / key focuses this box.
                        </span>
                    )}
                </AnimatePresence>
            </p>
        </div>
    );
}
