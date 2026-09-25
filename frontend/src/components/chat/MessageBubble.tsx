import { motion, useReducedMotion } from "framer-motion";
import type { Message } from "../../lib/api";

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const isStreaming = message.id === "streaming";
  const reduce = useReducedMotion();
  const content = typeof message.content === "string" ? message.content : "";
  const hasContent = content.trim().length > 0;

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formattedTime = message.created_at ? formatTime(message.created_at) : "";

  return (
    <motion.article
      className={`group/message w-full ${isUser ? "ml-auto max-w-[78%]" : "mr-auto"}`}
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
      aria-busy={isStreaming}
      aria-live={isStreaming ? "polite" : undefined}
    >
      {isUser ? (
        hasContent && (
          <p className="glass-1 ml-auto w-fit max-w-full rounded-lg rounded-tr-md bg-frost-2 px-4 py-2.5 text-base leading-6 whitespace-pre-wrap text-ink-bright break-words">
            {content}
          </p>
        )
      ) : (
        <div className="grid w-full grid-cols-[24px_minmax(0,1fr)] gap-3">
          <div
            className="glass-1 mt-1 flex size-6 items-center justify-center rounded-pill text-micro font-medium text-ink-soft group-data-[group-start=false]/start:hidden"
            aria-hidden="true"
          >
            U
          </div>

          <div className="presence-mark min-w-0 pl-4">
            <div className="mb-1 flex h-4 items-center group-data-[group-start=false]/start:hidden">
              <span className="text-micro font-medium tracking-[0.08em] text-presence">
                UNaFIED
              </span>
            </div>

            {hasContent ? (
              <p className="min-h-6 text-base leading-6 text-ink whitespace-pre-wrap break-words">
                {content}
                {isStreaming && (
                  <motion.span
                    className="ml-0.5 inline-block h-[1em] w-px translate-y-[2px] rounded-pill bg-presence align-middle"
                    initial={reduce ? false : { opacity: 0.25 }}
                    animate={reduce ? { opacity: 0.25 } : { opacity: [0.25, 1, 0.25] }}
                    transition={reduce ? { duration: 0 } : { duration: 1, repeat: Infinity, ease: "linear" }}
                    aria-hidden="true"
                  />
                )}
              </p>
            ) : (
              <div className="flex min-h-6 items-center gap-2" aria-label="UNaFIED is listening quietly">
                <span className="size-1.5 rounded-pill bg-presence" aria-hidden="true" />
                <span className="text-meta leading-6 text-ink-quiet">Listening quietly</span>
              </div>
            )}
          </div>
        </div>
      )}

      {formattedTime ? (
        <time
          className={`tnum mt-1 block w-fit rounded-xs px-1 opacity-0 transition-opacity duration-150 ease-glass group-hover/message:opacity-100 ${
            isUser ? "ml-auto" : "ml-[52px]"
          }`}
          dateTime={message.created_at}
          aria-label={`Message time ${formattedTime}`}
        >
          {formattedTime}
        </time>
      ) : null}
    </motion.article>
  );
}
