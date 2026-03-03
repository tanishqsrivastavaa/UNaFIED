import { useState, useRef, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface Props {
    onSend: (content: string) => void;
    disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
    const [value, setValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = () => {
        const trimmed = value.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setValue("");

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInput = () => {
        const el = textareaRef.current;
        if (el) {
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
        }
    };

    return (
        <div className="chat-input-bar">
            <textarea
                ref={textareaRef}
                className="chat-textarea"
                placeholder="Message UNaFIED…"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                rows={1}
                maxLength={4000}
                disabled={disabled}
            />
            <button
                className="chat-send"
                onClick={handleSend}
                disabled={!value.trim() || disabled}
                title="Send"
            >
                <Send size={18} />
            </button>

            <style>{`
        .chat-input-bar {
          display: flex;
          align-items: flex-end;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border-top: 1px solid var(--color-border);
          background: #fff;
        }
        .chat-textarea {
          flex: 1;
          resize: none;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: 0.7rem 1rem;
          font-size: 0.875rem;
          font-family: var(--font-sans);
          line-height: 1.4;
          outline: none;
          transition: border-color 0.2s;
          max-height: 120px;
        }
        .chat-textarea:focus {
          border-color: var(--color-accent);
        }
        .chat-textarea:disabled {
          opacity: 0.5;
        }
        .chat-send {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: var(--color-accent);
          color: #111;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s, transform 0.1s;
        }
        .chat-send:hover:not(:disabled) {
          background: var(--color-accent-hover);
        }
        .chat-send:active:not(:disabled) {
          transform: scale(0.93);
        }
        .chat-send:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
        </div>
    );
}
