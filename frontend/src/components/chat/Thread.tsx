import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import type { Message } from "../../lib/api";
import { readableReply } from "../../lib/reply";
import { cn } from "../../lib/cn";
import { useChatStore, type Peer, type Typing } from "../../stores/chatStore";
import Cursor from "../ui/Cursor";
import Display from "../ui/Display";
import Composer from "./Composer";
import { AgentMessage, HumanMessage } from "./Message";

const EASE = [0.22, 1, 0.36, 1] as const;
/** One column for header, messages and composer: 680px of text plus gutters. */
const MEASURE = "mx-auto w-full max-w-[728px] px-5 sm:px-6";
/** The server stamps no expiry on typing, so entries are dropped once this old. */
const TYPING_TTL = 6000;

const NO_MESSAGES: Message[] = [];
const NO_TYPING: Typing[] = [];
const NO_PEERS: Peer[] = [];

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function Thread({ conversationId }: { conversationId: string }) {
    const messages = useChatStore((s) => s.messages[conversationId] ?? NO_MESSAGES);
    const load = useChatStore((s) => s.loadState[conversationId] ?? "loading");
    const stream = useChatStore((s) => s.streaming[conversationId] ?? null);
    const notice = useChatStore((s) => s.notice[conversationId] ?? null);
    const typing = useChatStore((s) => s.typing[conversationId] ?? NO_TYPING);
    const peers = useChatStore((s) => s.peers[conversationId] ?? NO_PEERS);
    const status = useChatStore((s) => s.status[conversationId] ?? "connecting");
    const title = useChatStore((s) => s.conversations.find((c) => c.id === conversationId)?.title);
    const openThread = useChatStore((s) => s.openThread);
    const closeThread = useChatStore((s) => s.closeThread);
    const loadThread = useChatStore((s) => s.loadThread);
    const send = useChatStore((s) => s.send);
    const setTyping = useChatStore((s) => s.setTyping);

    /** Rows at or past this index arrived during this visit and get entrances. */
    const [liveFrom, setLiveFrom] = useState(Number.POSITIVE_INFINITY);
    const [now, setNow] = useState(() => Date.now());

    const rootRef = useRef<HTMLElement>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const pinnedRef = useRef(true);
    const landedRef = useRef(false);
    const primedRef = useRef(false);
    const seenRef = useRef(0);

    useEffect(() => {
        openThread(conversationId);
        return () => closeThread(conversationId);
    }, [conversationId, openThread, closeThread]);

    useEffect(() => {
        if (load !== "ready") return;
        if (!primedRef.current) {
            primedRef.current = true;
            seenRef.current = messages.length;
            return;
        }
        if (messages.length > seenRef.current) setLiveFrom((v) => Math.min(v, seenRef.current));
        seenRef.current = messages.length;
    }, [load, messages.length]);

    // The server never expires a typing flag, so drop entries once they age out.
    useEffect(() => {
        if (typing.length === 0) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [typing.length]);

    const typingNow = typing.filter((t) => t.at > now - TYPING_TTL);

    // Messages scroll under the floating composer; pad the list by its height.
    useLayoutEffect(() => {
        const composer = composerRef.current;
        const root = rootRef.current;
        if (!composer || !root) return;
        const observer = new ResizeObserver(([entry]) => {
            root.style.setProperty("--composer-h", `${Math.ceil(entry.borderBoxSize[0]?.blockSize ?? 0)}px`);
        });
        observer.observe(composer);
        return () => observer.disconnect();
    }, [load]);

    const thinking = stream !== null;
    const rows: Message[] =
        stream === null
            ? messages
            : [
                  ...messages,
                  {
                      id: "stream",
                      sender_id: null,
                      role: "assistant",
                      content: readableReply(stream),
                      suggestion: null,
                      is_proactive: false,
                      created_at: "",
                  },
              ];

    // Stay with the conversation as it grows — unless the reader scrolled up.
    // Keyed on the arrays themselves, not their length: settling a reply can attach
    // a proposal without adding a row. Scroll the one element directly;
    // scrollIntoView would also scroll the app shell.
    useLayoutEffect(() => {
        const el = scrollerRef.current;
        if (!el || load !== "ready") return;
        if (!landedRef.current) {
            el.scrollTop = el.scrollHeight;
            landedRef.current = true;
            return;
        }
        if (!pinnedRef.current) return;
        el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }, [load, messages, stream]);

    const handleScroll = () => {
        const el = scrollerRef.current;
        if (!el) return;
        pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    };

    const handleTyping = (value: boolean) => setTyping(conversationId, value);

    const activity = [
        peers.length ? `${peers.length} ${peers.length === 1 ? "other" : "others"} here` : "",
        typingNow.length
            ? `${typingNow.map((t) => t.email.split("@")[0]).join(", ")} ${typingNow.length === 1 ? "is" : "are"} typing…`
            : "",
    ]
        .filter(Boolean)
        .join("  ·  ");

    const heading = title ?? "";
    const count = messages.length;

    return (
        <motion.section
            ref={rootRef}
            aria-label={heading || "Conversation"}
            className="absolute inset-0 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18, ease: EASE } }}
            transition={{ duration: 0.45, ease: EASE }}
        >
            <header className="absolute inset-x-0 top-0 z-10">
                <div className={cn(MEASURE, "flex h-16 items-center gap-2")}>
                    <Link
                        to="/chat"
                        aria-label="Back to conversations"
                        className="btn btn-quiet btn-icon -ml-2.5 shrink-0 md:hidden"
                    >
                        <ArrowLeft size={18} aria-hidden="true" />
                    </Link>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-body font-semibold tracking-[-0.01em] text-ink" title={heading}>
                            {heading || "\u00a0"}
                        </h1>
                        {load === "ready" && count > 0 && (
                            <p className="tnum font-mono text-micro text-ink-4">
                                {count} {count === 1 ? "message" : "messages"}
                            </p>
                        )}
                    </div>
                    {load === "ready" && (
                        <p className="flex shrink-0 items-center gap-2 text-ink-3" role="status">
                            <Cursor mode={thinking ? "think" : "listen"} className="h-2.5 w-1.5 shadow-none" />
                            <span className="eyebrow">
                                {status === "online" ? (thinking ? "Thinking" : "Listening") : status === "connecting" ? "Connecting" : "Offline"}
                            </span>
                        </p>
                    )}
                </div>
            </header>

            <div
                ref={scrollerRef}
                onScroll={handleScroll}
                className="thread-fade min-h-0 flex-1 overflow-y-auto overscroll-contain"
                aria-busy={load === "loading"}
            >
                <div
                    className={cn(MEASURE, "flex min-h-full flex-col justify-end pt-32")}
                    style={{ paddingBottom: "calc(var(--composer-h, 96px) + 24px)" }}
                >
                    {load === "loading" ? (
                        <motion.p
                            className="flex items-center gap-3 font-mono text-sm text-ink-3"
                            role="status"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4, delay: 0.25 }}
                        >
                            <Cursor mode="think" className="h-3.5 w-2 shadow-none" />
                            Opening conversation…
                        </motion.p>
                    ) : load === "error" ? (
                        <div role="alert" className="max-w-[44ch]">
                            <p className="flex items-center gap-2.5 text-lg font-semibold text-ink">
                                <AlertCircle size={18} className="text-ink-3" aria-hidden="true" />
                                This conversation didn&rsquo;t load.
                            </p>
                            <p className="mt-2 text-body text-ink-3">
                                Try again, or open another conversation from the list.
                            </p>
                            <button type="button" className="btn btn-ghost mt-5" onClick={() => void loadThread(conversationId)}>
                                <RotateCcw size={15} aria-hidden="true" />
                                Try again
                            </button>
                        </div>
                    ) : rows.length === 0 ? (
                        <div>
                            <Display
                                as="h2"
                                lines={["Say", "something."]}
                                cursor
                                className="text-[clamp(60px,8vw,112px)] text-parchment"
                            />
                            <p className="mt-6 max-w-[46ch] text-body text-ink-3">
                                Ask a question, run some numbers, or look something up. UNaFIED answers here, and
                                asks before doing anything it can&rsquo;t undo.
                            </p>
                        </div>
                    ) : (
                        <motion.div
                            role="log"
                            aria-label="Messages"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: EASE }}
                        >
                            {rows.map((message, i) => {
                                const previous = rows[i - 1];
                                const startsRun = !previous || previous.role !== message.role;
                                const live = i >= liveFrom;
                                const inFlight = thinking && i === rows.length - 1;

                                return (
                                    <div key={i} className={cn(i > 0 && (startsRun ? "mt-8" : "mt-1.5"))}>
                                        {message.role === "user" ? (
                                            <HumanMessage message={message} live={live} />
                                        ) : (
                                            <AgentMessage
                                                message={message}
                                                live={live}
                                                showName={startsRun}
                                                phase={inFlight ? (message.content ? "writing" : "thinking") : "done"}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </motion.div>
                    )}

                    {activity && (
                        <p
                            className="mt-4 flex items-center gap-2 self-start font-mono text-micro text-ink-4"
                            role="status"
                            aria-live="polite"
                        >
                            <Cursor mode="listen" className="h-2 w-1 shadow-none" />
                            {activity}
                        </p>
                    )}

                    {notice && (
                        <motion.p
                            role="alert"
                            className="mt-6 flex items-start gap-2.5 self-start rounded-md border border-line-2 bg-veil-1 px-3.5 py-2.5 text-sm text-ink-2"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: EASE }}
                        >
                            <AlertCircle size={16} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                            {notice}
                        </motion.p>
                    )}
                </div>
            </div>

            {load === "ready" && (
                <motion.div
                    ref={composerRef}
                    className="absolute inset-x-0 bottom-0 z-10"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
                >
                    <Composer onSend={(content) => send(conversationId, content)} onTyping={handleTyping} busy={thinking} />
                </motion.div>
            )}
        </motion.section>
    );
}
