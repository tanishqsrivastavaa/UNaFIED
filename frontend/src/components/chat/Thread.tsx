import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import type { Message, Participant } from "../../lib/api";
import { readableReply } from "../../lib/reply";
import { cn } from "../../lib/cn";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore, type Peer, type Typing } from "../../stores/chatStore";
import Presence from "../ui/Presence";
import Composer from "./Composer";
import People from "./People";
import { AgentMessage, HumanMessage } from "./Message";

const EASE = [0.22, 1, 0.36, 1] as const;
/** One column for header, messages and composer: 680px of text plus gutters. */
const MEASURE = "mx-auto w-full max-w-[728px] px-5 sm:px-6";
/** The server stamps no expiry on typing, so entries are dropped once this old. */
const TYPING_TTL = 6000;

const NO_MESSAGES: Message[] = [];
const NO_TYPING: Typing[] = [];
const NO_PEERS: Peer[] = [];
const NO_PARTICIPANTS: Participant[] = [];

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
    const participants = useChatStore((s) => s.participants[conversationId] ?? NO_PARTICIPANTS);
    const me = useAuthStore((s) => s.user?.id);
    const status = useChatStore((s) => s.status[conversationId] ?? "connecting");
    const title = useChatStore((s) => s.conversations.find((c) => c.id === conversationId)?.title);
    const removed = useChatStore((s) => s.removed[conversationId] ?? false);
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

    const activity = typingNow.length
        ? `${typingNow.map((t) => t.email.split("@")[0]).join(", ")} ${typingNow.length === 1 ? "is" : "are"} typing…`
        : "";

    const heading = title ?? "";
    // Everyone else in the conversation, marked when they have it open right now.
    const here = new Set(peers.map((p) => p.userId));
    const members = participants.filter((p) => p.is_active && p.user_id !== me);
    const people = [
        ...members.map((p) => ({ id: p.user_id, name: p.email.split("@")[0], here: here.has(p.user_id) })),
        ...peers
            .filter((p) => p.userId !== me && !members.some((m) => m.user_id === p.userId))
            .map((p) => ({ id: p.userId, name: p.email.split("@")[0], here: true })),
    ];
    const connection =
        status === "online" ? (thinking ? "Thinking" : "Listening") : status === "connecting" ? "Connecting…" : "Offline";

    return (
        <motion.section
            ref={rootRef}
            aria-label={heading || "Conversation"}
            className="absolute inset-0 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE } }}
            transition={{ duration: 0.3, ease: EASE }}
        >
            <header className="absolute inset-x-0 top-0 z-10">
                <div className={cn(MEASURE, "flex h-16 items-center gap-1")}>
                    <Link
                        to="/chat"
                        aria-label="Back to conversations"
                        className="btn btn-quiet btn-icon -ml-2.5 shrink-0 md:hidden"
                    >
                        <ArrowLeft size={18} aria-hidden="true" />
                    </Link>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-body font-medium tracking-[-0.012em] text-ink" title={heading}>
                            {heading || "\u00a0"}
                        </h1>
                        {load === "ready" && !removed && people.length > 0 && (
                            <p className="flex min-w-0 items-center gap-1 overflow-hidden text-meta text-ink-4" aria-live="polite">
                                <span className="shrink-0">with</span>
                                {people.map((person, i) => (
                                    <span key={person.id} className="flex min-w-0 items-center gap-1.5">
                                        <span className={cn("truncate", person.here && "text-ink-2")}>{person.name}</span>
                                        {person.here && (
                                            <>
                                                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-ink-2" />
                                                <span className="sr-only">(here now)</span>
                                            </>
                                        )}
                                        {i < people.length - 1 && <span aria-hidden="true" className="-ml-1.5">,</span>}
                                    </span>
                                ))}
                            </p>
                        )}
                    </div>
                    {load === "ready" && !removed && <People conversationId={conversationId} />}
                    {/* Said aloud always; shown only when the connection needs attention. */}
                    {load === "ready" && !removed && (
                        <p
                            role="status"
                            className={cn(
                                "flex h-10 shrink-0 items-center gap-2 pl-2 text-meta text-ink-3",
                                status === "online" && "sr-only",
                            )}
                        >
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-ink-4" />
                            {connection}
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
                    className={cn(MEASURE, "flex min-h-full flex-col justify-end pt-28")}
                    style={{ paddingBottom: "calc(var(--composer-h, 96px) + 12px)" }}
                >
                    {removed ? (
                        <div role="status" className="my-auto max-w-[44ch]">
                            <p className="text-lg font-medium text-ink">You&rsquo;re no longer in this conversation.</p>
                            <p className="mt-2 text-body text-ink-3">
                                It&rsquo;s off your list now. If that&rsquo;s a mistake, ask someone in it to add you back.
                            </p>
                            <Link to="/chat" className="btn btn-ghost mt-5">
                                Back to conversations
                            </Link>
                        </div>
                    ) : load === "loading" ? (
                        <motion.p
                            className="my-auto flex items-center justify-center gap-3 text-sm text-ink-3"
                            role="status"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4, delay: 0.25 }}
                        >
                            <Presence mode="think" />
                            Opening conversation…
                        </motion.p>
                    ) : load === "error" ? (
                        <div role="alert" className="my-auto max-w-[44ch]">
                            <p className="flex items-center gap-2.5 text-lg font-medium text-ink">
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
                        <div className="my-auto flex flex-col items-center text-center">
                            <Presence mode="listen" className="size-2.5 shadow-[0_0_28px_6px_rgb(179_192_165/0.22)]" />
                            <h2 className="mt-7 text-lg font-medium tracking-[-0.015em] text-ink">Say something.</h2>
                            <p className="mt-2 max-w-[44ch] text-base text-ink-3">
                                Ask UNaFIED anything, or add someone by email to talk together. Once someone joins,
                                UNaFIED only answers when you mention @unafied.
                            </p>
                        </div>
                    ) : (
                        <motion.div
                            role="log"
                            aria-label="Messages"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4, ease: EASE }}
                        >
                            {rows.map((message, i) => {
                                const previous = rows[i - 1];
                                const startsRun =
                                    !previous || previous.role !== message.role || previous.sender_id !== message.sender_id;
                                const live = i >= liveFrom;
                                const inFlight = thinking && i === rows.length - 1;

                                return (
                                    <div key={i} className={cn(i > 0 && (startsRun ? "mt-7" : "mt-1.5"))}>
                                        {message.role === "user" ? (
                                            <HumanMessage
                                                message={message}
                                                live={live}
                                                mine={message.sender_id === me}
                                                showName={startsRun}
                                            />
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
                            className="mt-6 flex items-start gap-2.5 self-start rounded-md bg-fill-2 px-3.5 py-2.5 text-sm text-ink-2"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, ease: EASE }}
                        >
                            <AlertCircle size={16} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                            {notice}
                        </motion.p>
                    )}

                    <p
                        className={cn(
                            "mt-4 h-4 self-start text-meta text-ink-3 transition-opacity duration-300",
                            activity ? "opacity-100" : "opacity-0",
                        )}
                        role="status"
                        aria-live="polite"
                    >
                        {activity}
                    </p>
                </div>
            </div>

            {load === "ready" && !removed && (
                <motion.div
                    ref={composerRef}
                    className="absolute inset-x-0 bottom-0 z-10"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.05, ease: EASE }}
                >
                    <Composer onSend={(content) => send(conversationId, content)} onTyping={handleTyping} busy={thinking} />
                </motion.div>
            )}
        </motion.section>
    );
}
