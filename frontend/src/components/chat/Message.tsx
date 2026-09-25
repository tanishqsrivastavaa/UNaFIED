import { motion } from "framer-motion";
import type { Message } from "../../lib/api";
import { clock } from "../../lib/time";
import Cursor from "../ui/Cursor";
import Materialize from "../ui/Materialize";
import Ticket from "./Ticket";

const EASE = [0.22, 1, 0.36, 1] as const;

interface HumanProps {
    message: Message;
    /** Arrived during this visit, so it gets an entrance. */
    live: boolean;
}

/** People get the glass and the most contrast — they are what the reader came for. */
export function HumanMessage({ message, live }: HumanProps) {
    const time = message.created_at ? clock(message.created_at) : "";

    return (
        <motion.article
            className="group/msg flex items-end justify-end gap-3"
            initial={live ? { opacity: 0, y: 14, scale: 0.98 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: EASE }}
            style={{ transformOrigin: "100% 100%" }}
        >
            {time && (
                <time
                    dateTime={message.created_at}
                    className="mb-2 shrink-0 font-mono text-micro text-ink-4 opacity-0 transition-opacity duration-300 group-hover/msg:opacity-100 pointer-coarse:hidden"
                >
                    {time}
                </time>
            )}
            <p className="veil max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] rounded-br-md px-4 py-2.5 text-body text-ink sm:max-w-[78%]">
                {message.content}
            </p>
        </motion.article>
    );
}

interface AgentProps {
    message: Message;
    live: boolean;
    /** First agent message in a run: shows the name line. */
    showName: boolean;
    /** thinking: nothing yet. writing: text is arriving. done: settled. */
    phase: "thinking" | "writing" | "done";
}

/**
 * The agent is not a participant competing for attention, so it gets no
 * bubble. It writes like a terminal: mono, one tier quieter than people, with
 * its cursor at the end of the line while it works.
 */
export function AgentMessage({ message, live, showName, phase }: AgentProps) {
    const settled = phase === "done";
    const time = settled && message.created_at ? clock(message.created_at) : "";

    return (
        <motion.article
            className="max-w-full"
            initial={live ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: EASE }}
        >
            {showName && (
                <header className="mb-2 flex h-4 items-center gap-2">
                    <Cursor className="h-3 w-[7px] shadow-none" />
                    <span className="eyebrow normal-case text-blush">UNaFIED</span>
                    {time && (
                        <time dateTime={message.created_at} className="font-mono text-micro text-ink-4">
                            {time}
                        </time>
                    )}
                </header>
            )}

            <p className="whitespace-pre-wrap break-words font-mono text-base leading-[1.75] text-ink-2">
                <Materialize text={message.content} animate={live} />
                {!settled && (
                    <>
                        {phase === "thinking" && <span className="sr-only">UNaFIED is thinking</span>}
                        <Cursor
                            mode="think"
                            className={message.content ? "ml-1.5 h-[1.05em] w-[0.55em] align-[-0.2em]" : "h-[1.05em] w-[0.55em] align-[-0.2em]"}
                        />
                    </>
                )}
            </p>

            {settled && message.suggestion && <Ticket suggestion={message.suggestion} />}
        </motion.article>
    );
}
