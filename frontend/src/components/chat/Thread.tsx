import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { getConversationDetail, sendMessageStream, type Message } from "../../lib/api";
import { readableReply } from "../../lib/reply";
import { cn } from "../../lib/cn";
import { freshConversations, useChatStore } from "../../stores/chatStore";
import Cursor from "../ui/Cursor";
import Display from "../ui/Display";
import Composer from "./Composer";
import { AgentMessage, HumanMessage } from "./Message";

const EASE = [0.22, 1, 0.36, 1] as const;
/** One column for header, messages and composer: 680px of text plus gutters. */
const MEASURE = "mx-auto w-full max-w-[728px] px-5 sm:px-6";
const NOT_SENT = "Your message didn't send, so it's back in the box.";
const NO_REPLY = "UNaFIED didn't reply. Send a follow-up to try again.";

type LoadState = "loading" | "ready" | "error";

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function Thread({ conversationId }: { conversationId: string }) {
    const syncTitle = useChatStore((s) => s.syncTitle);
    const listTitle = useChatStore((s) => s.conversations.find((c) => c.id === conversationId)?.title);

    const [messages, setMessages] = useState<Message[]>([]);
    const [title, setTitle] = useState<string | null>(null);
    const [load, setLoad] = useState<LoadState>(() => (freshConversations.has(conversationId) ? "ready" : "loading"));
    const [attempt, setAttempt] = useState(0);
    /** The reply in flight: null when idle, "" while the agent thinks. */
    const [reply, setReply] = useState<string | null>(null);
    const [replyAt, setReplyAt] = useState("");
    /** Rows at or past this index arrived during this visit and get entrances. */
    const [liveFrom, setLiveFrom] = useState(Number.POSITIVE_INFINITY);
    const [notice, setNotice] = useState<string | null>(null);

    const rootRef = useRef<HTMLElement>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const pinnedRef = useRef(true);
    const landedRef = useRef(false);
    const aliveRef = useRef(true);

    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
        };
    }, []);

    useEffect(() => {
        // Nothing to fetch for a conversation this session just created, and a
        // late response would race the first message.
        if (attempt === 0 && freshConversations.has(conversationId)) return;
        let alive = true;
        getConversationDetail(conversationId)
            .then((data) => {
                if (!alive) return;
                setMessages(data.messages ?? []);
                setTitle(data.title);
                setLoad("ready");
                syncTitle(conversationId, data.title);
            })
            .catch(() => {
                if (alive) setLoad("error");
            });
        return () => {
            alive = false;
        };
    }, [conversationId, attempt, syncTitle]);

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

    const rows: Message[] =
        reply === null
            ? messages
            : [
                  ...messages,
                  {
                      id: "reply",
                      conversation_id: conversationId,
                      role: "assistant",
                      content: reply,
                      suggestion: null,
                      created_at: replyAt,
                  },
              ];

    // Stay with the conversation as it grows — unless the reader scrolled up.
    // Keyed on `messages` itself, not its length: the refetch after a reply can
    // attach a proposal without adding a row. Scroll the one element directly;
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
    }, [load, messages, reply]);

    const handleScroll = () => {
        const el = scrollerRef.current;
        if (!el) return;
        pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    };

    const send = useCallback(
        async (content: string): Promise<boolean> => {
            if (reply !== null) return false;

            freshConversations.delete(conversationId);
            const base = messages.length;
            const sentAt = new Date().toISOString();
            pinnedRef.current = true;
            setNotice(null);
            setLiveFrom((v) => Math.min(v, base));
            setMessages((m) => [
                ...m,
                {
                    id: `local-${sentAt}`,
                    conversation_id: conversationId,
                    role: "user",
                    content,
                    suggestion: null,
                    created_at: sentAt,
                },
            ]);
            setReplyAt(sentAt);
            setReply("");

            let raw = "";
            try {
                await sendMessageStream(
                    conversationId,
                    content,
                    (chunk) => {
                        raw += chunk;
                        if (aliveRef.current) setReply(readableReply(raw));
                    },
                    () => {},
                );
            } catch {
                if (!aliveRef.current) return false;
                setReply(null);
                // Ask the server what it kept before deciding what to tell the person.
                try {
                    const fresh = await getConversationDetail(conversationId);
                    if (!aliveRef.current) return false;
                    const list = fresh.messages ?? [];
                    const last = list[list.length - 1];
                    const kept = last?.role === "user" && last.content === content;
                    setMessages(list);
                    setNotice(kept ? NO_REPLY : NOT_SENT);
                    return kept;
                } catch {
                    if (!aliveRef.current) return false;
                    setMessages((m) => m.slice(0, base));
                    setNotice(NOT_SENT);
                    return false;
                }
            }

            if (!aliveRef.current) return true;

            // Settle the streamed reply in place (same row, so it doesn't replay),
            // then reconcile with the stored copy, which carries any proposal.
            setMessages((m) => [
                ...m,
                {
                    id: `local-reply-${sentAt}`,
                    conversation_id: conversationId,
                    role: "assistant",
                    content: readableReply(raw),
                    suggestion: null,
                    created_at: new Date().toISOString(),
                },
            ]);
            setReply(null);

            try {
                const fresh = await getConversationDetail(conversationId);
                if (!aliveRef.current) return true;
                setMessages(fresh.messages ?? []);
                setTitle(fresh.title);
                syncTitle(conversationId, fresh.title);
            } catch {
                // The local copy stands until the next load.
            }
            return true;
        },
        [conversationId, messages.length, reply, syncTitle],
    );

    const retry = () => {
        setLoad("loading");
        setAttempt((a) => a + 1);
    };

    const heading = title ?? listTitle ?? "";
    const thinking = reply !== null;
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
                            <span className="eyebrow">{thinking ? "Thinking" : "Listening"}</span>
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
                            <button type="button" className="btn btn-ghost mt-5" onClick={retry}>
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
                    <Composer onSend={send} busy={thinking} />
                </motion.div>
            )}
        </motion.section>
    );
}
