import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, DoorOpen, LogOut, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import { useReminderStore } from "../../stores/reminderStore";
import { ago } from "../../lib/time";
import { cn } from "../../lib/cn";
import { modKey } from "../../lib/platform";
import { EASE, rise, stagger } from "../../lib/motion";
import { unsubscribe as unsubscribePush } from "../../lib/push";
import Kbd from "../ui/Kbd";
import Wordmark from "../ui/Wordmark";
import ThemeToggle from "../ui/ThemeToggle";
import Reminders from "./Reminders";
import DirectChat from "./DirectChat";
import Settings from "./Settings";

const DISARM_MS = 3000;
const SKELETON = [64, 48, 72, 40, 56];

interface Props {
    onNew: () => void;
    creating: boolean;
    createError: string | null;
    className?: string;
}

export default function Rail({ onNew, creating, createError, className }: Props) {
    const conversations = useChatStore((s) => s.conversations);
    const listState = useChatStore((s) => s.listState);
    const load = useChatStore((s) => s.load);
    const remove = useChatStore((s) => s.remove);
    const leave = useChatStore((s) => s.leave);
    const reset = useChatStore((s) => s.reset);
    const unread = useChatStore((s) => s.unread);
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const { conversationId } = useParams();
    const navigate = useNavigate();

    const [now, setNow] = useState(() => Date.now());
    const [armedId, setArmedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [leaving, setLeaving] = useState(false);
    /** Rows stagger in the first time the list shows; later arrivals just fade in. */
    const [staggered, setStaggered] = useState(false);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    // A delete asks twice; the second ask expires on its own.
    useEffect(() => {
        if (!armedId) return;
        const timer = window.setTimeout(() => setArmedId(null), DISARM_MS);
        return () => window.clearTimeout(timer);
    }, [armedId]);

    /** Owners delete the conversation; everyone else leaves it. */
    const handleDelete = async (id: string, owns: boolean) => {
        if (armedId !== id) {
            setArmedId(id);
            return;
        }
        setArmedId(null);
        setDeletingId(id);
        setDeleteError(null);
        try {
            await (owns ? remove(id) : leave(id));
            if (conversationId === id) navigate("/chat", { replace: true });
        } catch {
            setDeleteError(owns ? "That conversation wasn't deleted. Try again." : "You're still in that conversation. Try again.");
        } finally {
            setDeletingId(null);
        }
    };

    const handleSignOut = async () => {
        setLeaving(true);
        // While still signed in, so the next person on this browser doesn't get these alerts.
        await unsubscribePush().catch(() => {});
        await logout();
        reset();
        useReminderStore.getState().reset();
        navigate("/login", { replace: true });
    };

    const email = user?.email ?? "";
    const actionError = createError ?? deleteError;

    return (
        <aside aria-label="Conversations" className={cn("flex h-full min-h-0 flex-col", className)}>
            <div className="flex h-14 shrink-0 items-center px-5 md:h-12 md:px-3">
                <Wordmark />
            </div>

            <div className="shrink-0 space-y-1 px-3 pt-2 md:px-1">
                <button
                    type="button"
                    onClick={onNew}
                    disabled={creating}
                    title={`New conversation (${modKey} K)`}
                    className="group/new btn h-10 w-full justify-start gap-2.5 rounded-[12px] bg-panel px-3 font-medium text-ink shadow-pill hover:bg-field"
                >
                    <Plus size={16} aria-hidden="true" />
                    <span className="flex-1 text-left">{creating ? "Starting…" : "New conversation"}</span>
                    <Kbd className="bg-transparent pointer-coarse:hidden">{modKey} K</Kbd>
                </button>
                <DirectChat />
            </div>

            <Reminders />

            <h2 className="sr-only">Conversations</h2>

            <nav aria-label="Conversation list" className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 md:px-1">
                {listState === "loading" ? (
                    <div role="status" className="space-y-1">
                        <span className="sr-only">Loading conversations</span>
                        {SKELETON.map((w, i) => (
                            <div key={i} aria-hidden="true" className="flex h-10 items-center px-3">
                                <span className="skeleton h-2.5 rounded-full" style={{ width: `${w}%` }} />
                            </div>
                        ))}
                    </div>
                ) : listState === "error" ? (
                    <motion.div role="alert" className="px-3 pt-1" {...rise}>
                        <p className="text-sm text-ink-2">Your conversations didn&rsquo;t load.</p>
                        <button type="button" className="btn btn-ghost mt-3 h-10 px-3.5 text-sm" onClick={() => void load()}>
                            <RotateCcw size={14} aria-hidden="true" />
                            Try again
                        </button>
                    </motion.div>
                ) : conversations.length === 0 ? (
                    <motion.p className="px-3 pt-1 text-sm text-ink-3" {...rise}>
                        Nothing here yet. Conversations you start will show up here.
                    </motion.p>
                ) : (
                    <ul className="space-y-0.5">
                        <AnimatePresence initial mode="popLayout">
                            {conversations.map((convo, i) => {
                                const active = convo.id === conversationId;
                                const armed = armedId === convo.id;
                                const deleting = deletingId === convo.id;
                                const title = convo.title || "Untitled";
                                const owns = !convo.owner_id || convo.owner_id === user?.id;
                                const verb = owns ? "Delete" : "Leave";
                                const fresh = unread[convo.id] && !active;

                                return (
                                    <motion.li
                                        key={convo.id}
                                        layout="position"
                                        className="group relative"
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE, delay: staggered ? 0 : stagger(i) } }}
                                        onAnimationComplete={() => setStaggered(true)}
                                        exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2, ease: EASE } }}
                                        transition={{ layout: { duration: 0.35, ease: EASE } }}
                                    >
                                        {active && (
                                            <motion.span
                                                layoutId="rail-active"
                                                aria-hidden="true"
                                                className="absolute inset-0 rounded-[10px] bg-panel shadow-pill"
                                                transition={{ duration: 0.3, ease: EASE }}
                                            />
                                        )}
                                        <Link
                                            to={`/chat/${convo.id}`}
                                            aria-current={active ? "page" : undefined}
                                            className={cn(
                                                "relative flex h-10 items-center rounded-[10px] pl-3 pr-3 text-base transition-colors duration-150 group-focus-within:pr-[88px] group-hover:pr-[88px] pointer-coarse:pr-12",
                                                active ? "font-medium text-ink" : "text-ink-2 hover:bg-hover-canvas hover:text-ink",
                                                armed && "pr-[88px]",
                                            )}
                                        >
                                            <span className={cn("truncate", fresh && "font-semibold text-ink")}>{title}</span>
                                            <AnimatePresence>
                                                {fresh && (
                                                    <motion.span
                                                        key="fresh"
                                                        className="ml-2 flex shrink-0 items-center"
                                                        initial={{ opacity: 0, scale: 0.4 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.4 }}
                                                        transition={{ duration: 0.2, ease: EASE }}
                                                    >
                                                        <span aria-hidden="true" className="size-1.5 rounded-full bg-ink" />
                                                        <span className="sr-only">(new messages)</span>
                                                    </motion.span>
                                                )}
                                            </AnimatePresence>
                                        </Link>
                                        <time
                                            dateTime={convo.updated_at}
                                            className={cn(
                                                "tnum pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 text-micro text-ink-3 opacity-0 transition-opacity duration-150 pointer-coarse:hidden",
                                                !armed && "group-focus-within:opacity-100 group-hover:opacity-100",
                                            )}
                                        >
                                            {ago(convo.updated_at, now)}
                                        </time>
                                        <button
                                            type="button"
                                            onClick={() => void handleDelete(convo.id, owns)}
                                            onBlur={() => armed && setArmedId(null)}
                                            disabled={deletingId !== null}
                                            aria-label={armed ? `Confirm ${verb.toLowerCase()} ${title}` : `${verb} ${title}`}
                                            aria-busy={deleting}
                                            className={cn(
                                                "btn btn-quiet absolute right-1 top-1/2 h-8 -translate-y-1/2 rounded-[8px] font-medium transition-[opacity,background-color,color] duration-150 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100",
                                                armed
                                                    ? "bg-ink px-3 text-sm text-panel opacity-100 hover:bg-ink hover:text-panel"
                                                    : "w-8 px-0 text-ink-3 opacity-0",
                                            )}
                                        >
                                            {armed ? verb : owns ? <Trash2 size={15} aria-hidden="true" /> : <DoorOpen size={15} aria-hidden="true" />}
                                        </button>
                                    </motion.li>
                                );
                            })}
                        </AnimatePresence>
                    </ul>
                )}
            </nav>

            <AnimatePresence>
                {actionError && (
                    <motion.p
                        role="alert"
                        className="mx-3 mb-3 flex items-start gap-2 rounded-md bg-panel px-3 py-2.5 text-sm text-ink-2 shadow-pill md:mx-1"
                        {...rise}
                    >
                        <AlertCircle size={15} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                        {actionError}
                    </motion.p>
                )}
            </AnimatePresence>

            <footer className="relative flex shrink-0 items-center gap-0.5 py-3 pl-5 pr-3 md:py-1 md:pl-3 md:pr-1">
                <span className="min-w-0 flex-1 truncate text-sm text-ink-3" title={email}>
                    {email}
                </span>
                <ThemeToggle />
                <Settings />
                <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    disabled={leaving}
                    aria-label="Sign out"
                    title="Sign out"
                    className="btn btn-quiet btn-icon shrink-0 text-ink-3"
                >
                    <LogOut size={16} aria-hidden="true" />
                </button>
            </footer>
        </aside>
    );
}
