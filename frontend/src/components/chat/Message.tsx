import { motion } from "framer-motion";
import type { Message } from "../../lib/api";
import { cn } from "../../lib/cn";
import { clock } from "../../lib/time";
import { EASE } from "../../lib/motion";
import Dots from "../ui/Dots";
import Materialize from "../ui/Materialize";
import Presence from "../ui/Presence";
import ReminderCard from "./ReminderCard";

interface HumanProps {
    message: Message;
    /** Arrived during this visit, so it gets an entrance. */
    live: boolean;
    /** Sent by the reader: right-aligned. Everyone else sits on the left. */
    mine: boolean;
    /** First message in someone else's run: shows who sent it. */
    showName: boolean;
}

/**
 * People get a surface and full contrast; they are what the reader came for.
 * Yours is the inverted one. Each rises from its own side as it arrives.
 */
export function HumanMessage({ message, live, mine, showName }: HumanProps) {
    const time = message.created_at ? clock(message.created_at) : "";
    const stamp = time && (
        <time
            dateTime={message.created_at}
            className="mb-2.5 shrink-0 text-micro text-ink-3 opacity-0 transition-opacity duration-150 group-hover/msg:opacity-100 pointer-coarse:hidden"
        >
            {time}
        </time>
    );

    return (
        <motion.article
            className={cn("group/msg flex flex-col", mine ? "items-end" : "items-start")}
            style={{ originX: mine ? 1 : 0, originY: 1 }}
            initial={live ? { opacity: 0, y: 8, scale: 0.98 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28, ease: EASE }}
        >
            {!mine && showName && (
                <p className="mb-1.5 px-1 text-meta font-medium text-ink-3">
                    {message.sender_email?.split("@")[0] ?? "Someone"}
                </p>
            )}
            <div className={cn("flex w-full items-end gap-3", mine ? "justify-end" : "justify-start")}>
                {mine && stamp}
                <p
                    className={cn(
                        "max-w-[85%] whitespace-pre-wrap break-words rounded-[18px] px-4 py-2.5 text-body sm:max-w-[78%]",
                        mine ? "rounded-br-[6px] bg-own text-on-own" : "rounded-bl-[6px] bg-other text-ink ring-1 ring-line-1 ring-inset",
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
 * The assistant is a presence in the room, not a participant competing for
 * attention, so it gets no surface. Its violet dots wave while it thinks and
 * trail the text while it writes.
 */
export function AgentMessage({ message, live, showName, phase }: AgentProps) {
    const settled = phase === "done";
    const time = settled && message.created_at ? clock(message.created_at) : "";

    return (
        <motion.article
            className="group/msg max-w-full"
            data-thinking={phase === "thinking" ? "" : undefined}
            initial={live ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
        >
            {showName && (
                <header className="mb-1.5 flex h-5 items-center gap-2">
                    <Presence mode={settled ? "rest" : "think"} />
                    <span className="text-meta font-medium text-accent">UNaFIED</span>
                    {time && (
                        <time
                            dateTime={message.created_at}
                            className="text-micro text-ink-3 opacity-0 transition-opacity duration-150 group-hover/msg:opacity-100 pointer-coarse:hidden"
                        >
                            {time}
                        </time>
                    )}
                </header>
            )}

            <p className="whitespace-pre-wrap break-words text-body leading-[1.7] text-ink-2">
                <Materialize text={message.content} animate={live} />
                {!settled && (
                    <>
                        {phase === "thinking" && <span className="sr-only">UNaFIED is thinking</span>}
                        <Dots className={cn("align-middle text-accent", message.content && "ml-2")} />
                    </>
                )}
            </p>

            {settled && message.suggestion?.tool_name === "reminder" && <ReminderCard suggestion={message.suggestion} live={live} />}
        </motion.article>
    );
}
