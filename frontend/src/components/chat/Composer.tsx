import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "../../lib/cn";
import Kbd from "../ui/Kbd";

const MAX_HEIGHT = 168;

interface Props {
    /** Resolves false when the message didn't go out, so the text comes back. */
    onSend: (text: string) => Promise<boolean>;
    /** A reply is in flight: typing is fine, sending waits. */
    busy: boolean;
}

export default function Composer({ onSend, busy }: Props) {
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const armed = value.trim().length > 0 && !busy;

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
        <div className="mx-auto w-full max-w-[728px] px-3 pb-3 sm:px-6 sm:pb-4">
            <form
                onSubmit={handleSubmit}
                className="glass flex items-end gap-2 rounded-[26px] p-1.5 transition-[border-color] duration-300 ease-out focus-within:border-line-3"
            >
                <label htmlFor="composer" className="sr-only">
                    Message
                </label>
                <textarea
                    id="composer"
                    ref={inputRef}
                    rows={1}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Write a message…"
                    maxLength={4000}
                    aria-describedby="composer-hint"
                    className="min-h-10 flex-1 resize-none bg-transparent px-3.5 py-2 text-body text-ink placeholder:text-ink-4 focus:outline-none"
                    style={{ maxHeight: MAX_HEIGHT }}
                />
                <button
                    type="submit"
                    disabled={!armed}
                    aria-label="Send message"
                    className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-300 ease-out active:scale-95 disabled:cursor-not-allowed",
                        armed ? "bg-parchment text-dusk" : "bg-veil-2 text-ink-4",
                    )}
                >
                    <ArrowUp size={18} strokeWidth={2.2} aria-hidden="true" />
                </button>
            </form>

            <p
                id="composer-hint"
                className="mt-2 flex h-5 items-center justify-center gap-1.5 font-mono text-micro text-ink-4"
            >
                {busy ? (
                    "You can send once UNaFIED has replied."
                ) : (
                    <span className="flex items-center gap-1.5 pointer-coarse:hidden">
                        <Kbd>↵</Kbd> send
                        <span className="mx-1 text-mark" aria-hidden="true">
                            ·
                        </span>
                        <Kbd>⇧ ↵</Kbd> new line
                        <span className="mx-1 text-mark" aria-hidden="true">
                            ·
                        </span>
                        <Kbd>/</Kbd> focus
                    </span>
                )}
            </p>
        </div>
    );
}
