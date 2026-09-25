import { useState, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface Props {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const hasText = value.trim().length > 0;
  const armed = hasText && !disabled;

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative w-full shrink-0">
      <div className="w-full px-5 pt-3 pb-5">
        <div className="mx-auto w-full max-w-[720px]">
          <div
            className={`glass-2 flex items-end gap-2 rounded-lg p-2 transition-opacity duration-150 ease-glass focus-within:border-presence-edge focus-within:shadow-[0_0_28px_var(--color-presence-glow)] ${
              disabled ? "pointer-events-none opacity-60" : "opacity-100"
            }`}
            aria-busy={disabled}
            aria-disabled={disabled}
          >
            <label htmlFor="message" className="sr-only">
              Message UNaFIED
            </label>
            <textarea
              id="message"
              className="min-h-10 max-h-[120px] w-full min-w-0 flex-1 resize-none overflow-y-auto rounded-sm bg-transparent px-3 py-2 text-base leading-6 text-ink-bright [field-sizing:content] placeholder:text-ink-quiet focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
              placeholder="Message UNaFIED…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={4000}
              disabled={disabled}
              aria-describedby="message-hint"
            />
            <button
              className={`btn btn-ghost w-10 shrink-0 p-0 ${
                armed ? "border-edge-soft bg-frost-3 text-ink-bright" : ""
              }`}
              type="button"
              onClick={handleSend}
              disabled={!hasText || disabled}
              title="Send"
              aria-label="Send"
            >
              <Send size={16} aria-hidden="true" />
            </button>
          </div>

          <p
            id="message-hint"
            className={`mt-2 min-h-4 pl-5 text-micro leading-4 text-ink-quiet select-none transition-opacity duration-150 ease-glass ${
              hasText ? "opacity-0" : "opacity-100"
            }`}
          >
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      </div>
    </div>
  );
}
