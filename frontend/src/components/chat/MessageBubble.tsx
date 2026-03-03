import type { Message } from "../../lib/api";

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={`bubble-row ${isUser ? "bubble-user" : "bubble-ai"}`}>
      {!isUser && (
        <div className="bubble-avatar">
          <span>U</span>
        </div>
      )}

      <div className="bubble-content">
        {!isUser && <span className="bubble-name">UNaFIED</span>}
        <div className={`bubble ${isUser ? "bubble-right" : "bubble-left"}`}>
          {message.content}
        </div>
        <span className="bubble-time">
          {message.created_at ? formatTime(message.created_at) : ""}
        </span>
      </div>

      <style>{`
        .bubble-row {
          display: flex;
          gap: 0.6rem;
          margin-bottom: 1rem;
          max-width: 75%;
        }
        .bubble-user {
          margin-left: auto;
          flex-direction: row-reverse;
        }
        .bubble-ai {
          margin-right: auto;
        }
        .bubble-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--color-accent);
          color: #111;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.75rem;
          flex-shrink: 0;
          margin-top: 1.2rem;
        }
        .bubble-content {
          display: flex;
          flex-direction: column;
        }
        .bubble-name {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          margin-bottom: 0.2rem;
        }
        .bubble {
          padding: 0.7rem 1rem;
          font-size: 0.875rem;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .bubble-right {
          background: var(--color-bubble-user);
          border: 1px solid var(--color-border);
          border-radius: 12px 12px 2px 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .bubble-left {
          background: var(--color-bubble-ai);
          border: 1px solid var(--color-border);
          border-radius: 12px 12px 12px 2px;
        }
        .bubble-time {
          font-size: 0.65rem;
          color: var(--color-text-muted);
          margin-top: 0.2rem;
        }
        .bubble-user .bubble-time {
          text-align: right;
        }
      `}</style>
    </div>
  );
}
