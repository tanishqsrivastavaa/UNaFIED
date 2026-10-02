import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, LogOut, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import { useReminderStore } from "../../stores/reminderStore";
import { ago } from "../../lib/time";
import { cn } from "../../lib/cn";
import { modKey } from "../../lib/platform";
import Kbd from "../ui/Kbd";
import Wordmark from "../ui/Wordmark";
import Reminders from "./Reminders";
import DirectChat from "./DirectChat";
import Settings from "./Settings";

const EASE = [0.22, 1, 0.36, 1] as const;
const DISARM_MS = 3000;

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

    const handleDelete = async (id: string) => {
        if (armedId !== id) {
            setArmedId(id);
            return;
        }
        setArmedId(null);
        setDeletingId(id);
        setDeleteError(null);
        try {
            await remove(id);
            if (conversationId === id) navigate("/chat", { replace: true });
        } catch {
            setDeleteError("That conversation wasn't deleted. Try again.");
        } finally {
            setDeletingId(null);
        }
    };

    const handleSignOut = async () => {
        setLeaving(true);
        await logout();
        reset();
        useReminderStore.getState().reset();
        navigate("/login", { replace: true });
    };

    const email = user?.email ?? "";
    const actionError = createError ?? deleteError;

    return (
        <motion.aside
            aria-label="Conversations"
            className={cn("flex h-full min-h-0 flex-col", className)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
        >
            <div className="flex h-16 shrink-0 items-center px-6">
                <Wordmark />
            </div>

            <div className="shrink-0 space-y-px px-3 pt-2">
                <button
                    type="button"
                    onClick={onNew}
                    disabled={creating}
                    title={`New conversation (${modKey} K)`}
                    className="group/new btn btn-quiet h-10 w-full justify-start gap-2.5 rounded-[10px] px-3 font-medium text-ink-2"
                >
                    <Plus size={16} aria-hidden="true" />
                    <span className="flex-1 text-left">{creating ? "Starting…" : "New conversation"}</span>
                    <Kbd className="opacity-0 transition-opacity duration-200 group-hover/new:opacity-100 group-focus-visible/new:opacity-100 pointer-coarse:hidden">
                        {modKey} K
                    </Kbd>
                </button>
                <DirectChat />
            </div>

            <Reminders />

            <h2 className="sr-only">Conversations</h2>

            <nav aria-label="Conversation list" className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
                {listState === "loading" ? (
                    <div role="status" className="space-y-1">
                        <span className="sr-only">Loading conversations</span>
                        {[64, 48, 72, 40].map((w, i) => (
                            <div key={i} aria-hidden="true" className="flex h-10 items-center px-3">
                                <span
                                    className="h-2 animate-breathe rounded-full bg-fill-3"
                                    style={{ width: `${w}%`, animationDelay: `${i * 180}ms` }}
                                />
                            </div>
                        ))}
                    </div>
                ) : listState === "error" ? (
                    <div role="alert" className="px-3 pt-1">
                        <p className="text-sm text-ink-2">Your conversations didn&rsquo;t load.</p>
                        <button type="button" className="btn btn-ghost mt-3 h-10 px-3.5 text-sm" onClick={() => void load()}>
                            <RotateCcw size={14} aria-hidden="true" />
                            Try again
                        </button>
                    </div>
                ) : conversations.length === 0 ? (
                    <p className="px-3 pt-1 text-sm text-ink-4">
                        Nothing here yet. Conversations you start will show up here.
                    </p>
                ) : (
                    <ul className="space-y-px">
                        <AnimatePresence initial={false} mode="popLayout">
                            {conversations.map((convo) => {
                                const active = convo.id === conversationId;
                                const armed = armedId === convo.id;
                                const deleting = deletingId === convo.id;
                                const title = convo.title || "Untitled";
                                const fresh = unread[convo.id] && !active;

                                return (
                                    <motion.li
                                        key={convo.id}
                                        layout="position"
                                        className="group relative"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.25, ease: EASE }}
                                    >
                                        {active && (
                                            <motion.span
                                                layoutId="rail-active"
                                                aria-hidden="true"
                                                className="absolute inset-0 rounded-[10px] bg-fill-2"
                                                transition={{ duration: 0.35, ease: EASE }}
                                            />
                                        )}
                                        <Link
                                            to={`/chat/${convo.id}`}
                                            aria-current={active ? "page" : undefined}
                                            className={cn(
                                                "relative flex h-10 items-center rounded-[10px] pl-3 pr-3 text-base transition-colors duration-200 group-focus-within:pr-[88px] group-hover:pr-[88px] pointer-coarse:pr-12",
                                                active ? "text-ink" : "text-ink-3 hover:bg-fill-1 hover:text-ink",
                                                armed && "pr-[88px]",
                                            )}
                                        >
                                            <span className={cn("truncate", fresh && "font-medium text-ink")}>{title}</span>
                                            {fresh && (
                                                <>
                                                    <span aria-hidden="true" className="ml-2 size-1.5 shrink-0 rounded-full bg-ink-2" />
                                                    <span className="sr-only">(new messages)</span>
                                                </>
                                            )}
                                        </Link>
                                        <time
                                            dateTime={convo.updated_at}
                                            className={cn(
                                                "tnum pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 text-micro text-ink-4 opacity-0 transition-opacity duration-200 pointer-coarse:hidden",
                                                !armed && "group-focus-within:opacity-100 group-hover:opacity-100",
                                            )}
                                        >
                                            {ago(convo.updated_at, now)}
                                        </time>
                                        <button
                                            type="button"
                                            onClick={() => void handleDelete(convo.id)}
                                            onBlur={() => armed && setArmedId(null)}
                                            disabled={deletingId !== null}
                                            aria-label={armed ? `Confirm delete ${title}` : `Delete ${title}`}
                                            aria-busy={deleting}
                                            className={cn(
                                                "btn btn-quiet absolute right-0 top-1/2 h-10 -translate-y-1/2 rounded-[10px] font-medium transition-[opacity,background-color,color] duration-200 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100",
                                                armed
                                                    ? "bg-fill-3 px-3 text-sm text-ink opacity-100"
                                                    : "w-10 px-0 text-ink-4 opacity-0",
                                            )}
                                        >
                                            {armed ? "Delete" : <Trash2 size={15} aria-hidden="true" />}
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
                        className="mx-3 mb-3 flex items-start gap-2 rounded-md bg-fill-2 px-3 py-2.5 text-sm text-ink-2"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: EASE }}
                    >
                        <AlertCircle size={15} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                        {actionError}
                    </motion.p>
                )}
            </AnimatePresence>

            <footer className="relative flex shrink-0 items-center gap-1 py-3 pl-6 pr-3">
                <span className="min-w-0 flex-1 truncate text-sm text-ink-4" title={email}>
                    {email}
                </span>
                <Settings />
                <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    disabled={leaving}
                    aria-label="Sign out"
                    title="Sign out"
                    className="btn btn-quiet btn-icon shrink-0 text-ink-4"
                >
                    <LogOut size={16} aria-hidden="true" />
                </button>
            </footer>
        </motion.aside>
    );
}
