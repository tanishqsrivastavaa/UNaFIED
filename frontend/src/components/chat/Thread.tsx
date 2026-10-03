import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import type { Message, Participant } from "../../lib/api";
import { readableReply } from "../../lib/reply";
import { cn } from "../../lib/cn";
import { EASE, rise } from "../../lib/motion";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore, type Peer, type Typing } from "../../stores/chatStore";
import Dots from "../ui/Dots";
import Presence from "../ui/Presence";
import Composer from "./Composer";
import People from "./People";
import { AgentMessage, HumanMessage } from "./Message";

/** One column for header, messages and composer: 712px of text plus gutters. */
const MEASURE = "mx-auto w-full max-w-[760px] px-5 sm:px-6";
/**
 * The server stamps no expiry on typing, and a "stopped" can be lost, so a typer
 * drops off this long after their last signal. Senders repeat theirs every 2.5s.
 */
const TYPING_TTL = 5000;
const SKELETON: { mine: boolean; w: number }[] = [
    { mine: false, w: 46 },
    { mine: true, w: 38 },
    { mine: false, w: 58 },
    { mine: true, w: 30 },
];

const NO_MESSAGES: Message[] = [];
const NO_TYPING: Typing[] = [];
const NO_PEERS: Peer[] = [];
const NO_PARTICIPANTS: Participant[] = [];

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** "priya", "priya and sam", "priya, sam and 2 others". */
function names(list: string[]) {
    if (list.length <= 2) return list.join(" and ");
    return `${list.slice(0, 2).join(", ")} and ${list.length - 2 === 1 ? "1 other" : `${list.length - 2} others`}`;
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

    /**
     * How many messages were already here when the thread loaded: history, which doesn't replay
     * its entrance. Rows past it arrived during this visit. Set during render (React's pattern for
     * state derived from props), not in an effect: a row must know it is new when it mounts, since
     * an entrance can't be added to a row that has already appeared.
     */
    const [history, setHistory] = useState<number | null>(null);
    if (history === null && load === "ready") setHistory(messages.length);
    const [now, setNow] = useState(() => Date.now());
    /** On a phone the thread is pushed in from the side, over the list it replaces. */
    const [phone] = useState(() => window.matchMedia("(max-width: 767px)").matches);

    const rootRef = useRef<HTMLElement>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const pinnedRef = useRef(true);
    const landedRef = useRef(false);

    useEffect(() => {
        openThread(conversationId);
        return () => closeThread(conversationId);
    }, [conversationId, openThread, closeThread]);

    // Wake exactly when the next typer runs out, rather than polling.
    useEffect(() => {
        // Expired entries stay in the store until a "stopped" or a message clears them; skip those.
        const ends = typing.map((t) => t.at + TYPING_TTL).filter((end) => end > now);
        if (ends.length === 0) return;
        const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, Math.min(...ends) - Date.now()) + 16);
        return () => window.clearTimeout(timer);
    }, [typing, now]);

    const typers = typing.filter((t) => t.at > now - TYPING_TTL && t.userId !== me).map((t) => t.email.split("@")[0]);
    const someoneTyping = typers.length > 0;

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

    // Stay with the conversation as it grows, unless the reader scrolled up.
    // Keyed on the arrays themselves, not their length: settling a reply can attach
    // a proposal without adding a row. The typing row counts too. Scroll the one
    // element directly; scrollIntoView would also scroll the app shell.
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
    }, [load, messages, stream, someoneTyping]);

    const handleScroll = () => {
        const el = scrollerRef.current;
        if (!el) return;
        pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    };

    const handleTyping = (value: boolean) => setTyping(conversationId, value);

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
            initial={{ opacity: 0, x: phone ? 16 : 0, y: phone ? 0 : 6 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE } }}
            transition={{ duration: 0.28, ease: EASE }}
        >
            <header className="absolute inset-x-0 top-0 z-10">
                <div className={cn(MEASURE, "flex h-16 items-center gap-1")}>
                    <Link to="/chat" aria-label="Back to conversations" className="btn btn-quiet btn-icon -ml-2.5 shrink-0 md:hidden">
                        <ArrowLeft size={18} aria-hidden="true" />
                    </Link>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-body font-medium tracking-[-0.012em] text-ink" title={heading}>
                            {heading || " "}
                        </h1>
                        {load === "ready" && !removed && people.length > 0 && (
                            <motion.p
                                className="flex min-w-0 items-center gap-1 overflow-hidden text-meta text-ink-3"
                                aria-live="polite"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.28, ease: EASE }}
                            >
                                <span className="shrink-0">with</span>
                                {people.map((person, i) => (
                                    <span key={person.id} className="flex min-w-0 items-center gap-1.5">
                                        <span className={cn("truncate", person.here && "text-ink-2")}>{person.name}</span>
                                        <AnimatePresence initial={false}>
                                            {person.here && (
                                                <motion.span
                                                    key="here"
                                                    className="flex shrink-0 items-center"
                                                    initial={{ opacity: 0, scale: 0.4 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.4 }}
                                                    transition={{ duration: 0.2, ease: EASE }}
                                                >
                                                    <span aria-hidden="true" className="size-1.5 rounded-full bg-ink-2" />
                                                    <span className="sr-only">(here now)</span>
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                        {i < people.length - 1 && <span aria-hidden="true" className="-ml-1.5">,</span>}
                                    </span>
                                ))}
                            </motion.p>
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
                            <span aria-hidden="true" className="size-1.5 animate-breathe-fast rounded-full bg-ink-3" />
                            {connection}
                        </p>
                    )}
                </div>
            </header>

            <div
                ref={scrollerRef}
                onScroll={handleScroll}
                className="thread-fade relative z-[1] min-h-0 flex-1 overflow-y-auto overscroll-contain"
                aria-busy={load === "loading"}
            >
                <div
                    className={cn(MEASURE, "flex min-h-full flex-col justify-end pt-28")}
                    style={{ paddingBottom: "calc(var(--composer-h, 96px) + 12px)" }}
                >
                    {removed ? (
                        <motion.div role="status" className="my-auto max-w-[44ch]" {...rise}>
                            <p className="text-lg font-medium text-ink">You&rsquo;re no longer in this conversation.</p>
                            <p className="mt-2 text-body text-ink-3">
                                It&rsquo;s off your list now. If that&rsquo;s a mistake, ask someone in it to add you back.
                            </p>
                            <Link to="/chat" className="btn btn-ghost mt-5">
                                Back to conversations
                            </Link>
                        </motion.div>
                    ) : load === "loading" ? (
                        <motion.div
                            role="status"
                            className="space-y-3"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3, delay: 0.15 }}
                        >
                            <span className="sr-only">Opening conversation…</span>
                            {SKELETON.map((b, i) => (
                                <div key={i} aria-hidden="true" className={cn("flex", b.mine ? "justify-end" : "justify-start")}>
                                    <span
                                        className={cn("skeleton block h-11 rounded-[18px]", b.mine ? "rounded-br-[6px]" : "rounded-bl-[6px]")}
                                        style={{ width: `${b.w}%` }}
                                    />
                                </div>
                            ))}
                        </motion.div>
                    ) : load === "error" ? (
                        <motion.div role="alert" className="my-auto max-w-[44ch]" {...rise}>
                            <p className="flex items-center gap-2.5 text-lg font-medium text-ink">
                                <AlertCircle size={18} className="text-ink-3" aria-hidden="true" />
                                This conversation didn&rsquo;t load.
                            </p>
                            <p className="mt-2 text-body text-ink-3">Try again, or open another conversation from the list.</p>
                            <button type="button" className="btn btn-ghost mt-5" onClick={() => void loadThread(conversationId)}>
                                <RotateCcw size={15} aria-hidden="true" />
                                Try again
                            </button>
                        </motion.div>
                    ) : rows.length === 0 ? (
                        <div className="my-auto flex flex-col items-center text-center">
                            <motion.span
                                initial={{ opacity: 0, scale: 0.6 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.35, ease: EASE }}
                            >
                                <Presence mode="listen" className="size-2.5" />
                            </motion.span>
                            <motion.h2
                                className="mt-6 text-lg font-medium tracking-[-0.015em] text-ink"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.28, delay: 0.06, ease: EASE }}
                            >
                                Say something.
                            </motion.h2>
                            <motion.p
                                className="mt-2 max-w-[44ch] text-base text-ink-3"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.28, delay: 0.12, ease: EASE }}
                            >
                                Ask UNaFIED anything, or add someone by email to talk together. Once someone joins,
                                UNaFIED only answers when you mention @unafied.
                            </motion.p>
                        </div>
                    ) : (
                        <motion.div
                            role="log"
                            aria-label="Messages"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3, ease: EASE }}
                        >
                            {rows.map((message, i) => {
                                const previous = rows[i - 1];
                                const startsRun =
                                    !previous || previous.role !== message.role || previous.sender_id !== message.sender_id;
                                const live = history !== null && i >= history;
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
                                                live={live || inFlight}
                                                showName={startsRun}
                                                phase={inFlight ? (message.content ? "writing" : "thinking") : "done"}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </motion.div>
                    )}

                    <AnimatePresence>
                        {notice && (
                            <motion.p
                                role="alert"
                                className="mt-6 flex items-start gap-2.5 self-start rounded-md bg-fill-2 px-3.5 py-2.5 text-sm text-ink-2"
                                {...rise}
                            >
                                <AlertCircle size={16} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                                {notice}
                            </motion.p>
                        )}
                    </AnimatePresence>

                    {/* Someone else is writing: their dots wave where their message will land. */}
                    <div role="status" aria-live="polite" className="self-start">
                        <AnimatePresence>
                            {someoneTyping && (
                                <motion.div
                                    key="typing"
                                    data-typing
                                    className="mt-4 flex items-center gap-2.5"
                                    style={{ originX: 0, originY: 1 }}
                                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: EASE } }}
                                    transition={{ duration: 0.2, ease: EASE }}
                                >
                                    <span className="sr-only">
                                        {names(typers)} {typers.length === 1 ? "is" : "are"} typing
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        className="flex h-9 items-center rounded-[18px] rounded-bl-[6px] bg-other px-3.5 text-ink-2 ring-1 ring-line-1 ring-inset"
                                    >
                                        <Dots />
                                    </span>
                                    <span aria-hidden="true" className="text-meta text-ink-3">
                                        {names(typers)}
                                    </span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* While the assistant works, a soft light rises behind the composer. */}
            <AnimatePresence>
                {thinking && load === "ready" && !removed && (
                    <motion.div
                        key="glow"
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-56"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.3, ease: EASE } }}
                        transition={{ duration: 0.4, ease: EASE }}
                    >
                        <div className="thinking-glow absolute inset-0" />
                    </motion.div>
                )}
            </AnimatePresence>

            {load === "ready" && !removed && (
                <motion.div
                    ref={composerRef}
                    className="absolute inset-x-0 bottom-0 z-10"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05, ease: EASE }}
                >
                    <Composer onSend={(content) => send(conversationId, content)} onTyping={handleTyping} busy={thinking} />
                </motion.div>
            )}
        </motion.section>
    );
}
