import { motion } from "framer-motion";
import type { Message } from "../../lib/api";
import { cn } from "../../lib/cn";
import { clock } from "../../lib/time";
import Cursor from "../ui/Cursor";
import Materialize from "../ui/Materialize";
import Ticket from "./Ticket";

const EASE = [0.22, 1, 0.36, 1] as const;

interface HumanProps {
    message: Message;
    /** Arrived during this visit, so it gets an entrance. */
    live: boolean;
    /** Sent by the reader: right-aligned. Everyone else sits on the left. */
    mine: boolean;
    /** First message in someone else's run: shows who sent it. */
    showName: boolean;
}

/** People get the glass and the most contrast — they are what the reader came for. */
export function HumanMessage({ message, live, mine, showName }: HumanProps) {
    const time = message.created_at ? clock(message.created_at) : "";
    const stamp = time && (
        <time
            dateTime={message.created_at}
            className="mb-2 shrink-0 font-mono text-micro text-ink-4 opacity-0 transition-opacity duration-300 group-hover/msg:opacity-100 pointer-coarse:hidden"
        >
            {time}
        </time>
    );

    return (
        <motion.article
            className={cn("group/msg flex flex-col", mine ? "items-end" : "items-start")}
            initial={live ? { opacity: 0, y: 14, scale: 0.98 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: EASE }}
            style={{ transformOrigin: mine ? "100% 100%" : "0% 100%" }}
        >
            {!mine && showName && (
                <p className="mb-1.5 px-1 text-micro font-semibold text-ink-3">
                    {message.sender_email?.split("@")[0] ?? "Someone"}
                </p>
            )}
            <div className={cn("flex w-full items-end gap-3", mine ? "justify-end" : "justify-start")}>
                {mine && stamp}
                <p
                    className={cn(
                        "veil max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] px-4 py-2.5 text-body text-ink sm:max-w-[78%]",
                        mine ? "rounded-br-md" : "rounded-bl-md"
                    )}
                >
                    {message.content}
                </p>
                {!mine && stamp}
            </div>
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
