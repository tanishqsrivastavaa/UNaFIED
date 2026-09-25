import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, LogOut, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import { ago } from "../../lib/time";
import { cn } from "../../lib/cn";
import { modKey } from "../../lib/platform";
import Kbd from "../ui/Kbd";
import Wordmark from "../ui/Wordmark";

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
        navigate("/login", { replace: true });
    };

    const email = user?.email ?? "";
    const actionError = createError ?? deleteError;

    return (
        <motion.aside
            aria-label="Conversations"
            className={cn("glass flex h-full min-h-0 flex-col rounded-[28px]", className)}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
        >
            <div className="flex h-16 shrink-0 items-center px-5">
                <Wordmark />
            </div>

            <div className="shrink-0 px-3">
                <button
                    type="button"
                    onClick={onNew}
                    disabled={creating}
                    className="btn btn-ghost h-11 w-full justify-between pl-3.5 pr-2.5 font-medium"
                >
                    <span className="flex items-center gap-2.5">
                        <Plus size={16} aria-hidden="true" />
                        {creating ? "Starting…" : "New conversation"}
                    </span>
                    <Kbd className="pointer-coarse:hidden">{modKey} K</Kbd>
                </button>
            </div>

            <div className="mt-7 flex shrink-0 items-center justify-between px-5 pb-2">
                <h2 className="eyebrow text-ink-4">Conversations</h2>
                {listState === "ready" && conversations.length > 0 && (
                    <span className="eyebrow tnum text-ink-4">{conversations.length}</span>
                )}
            </div>

            <nav aria-label="Conversation list" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
                {listState === "loading" ? (
                    <div role="status" className="space-y-1 pt-1">
                        <span className="sr-only">Loading conversations</span>
                        {[64, 48, 72, 40].map((w, i) => (
                            <div key={i} aria-hidden="true" className="flex h-11 items-center px-3.5">
                                <span
                                    className="h-2.5 animate-breathe rounded-full bg-veil-3"
                                    style={{ width: `${w}%`, animationDelay: `${i * 180}ms` }}
                                />
                            </div>
                        ))}
                    </div>
                ) : listState === "error" ? (
                    <div role="alert" className="px-2 pt-2">
                        <p className="text-sm text-ink-2">Your conversations didn&rsquo;t load.</p>
                        <button type="button" className="btn btn-ghost mt-3 h-10 px-3.5 text-sm" onClick={() => void load()}>
                            <RotateCcw size={14} aria-hidden="true" />
                            Try again
                        </button>
                    </div>
                ) : conversations.length === 0 ? (
                    <p className="px-2 pt-2 text-sm text-ink-4">
                        Nothing here yet. Conversations you start will show up here.
                    </p>
                ) : (
                    <ul className="space-y-0.5">
                        <AnimatePresence initial={false} mode="popLayout">
                            {conversations.map((convo) => {
                                const active = convo.id === conversationId;
                                const armed = armedId === convo.id;
                                const deleting = deletingId === convo.id;
                                const title = convo.title || "Untitled";

                                return (
                                    <motion.li
                                        key={convo.id}
                                        layout="position"
                                        className="group relative"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -8 }}
                                        transition={{ duration: 0.35, ease: EASE }}
                                    >
                                        {active && (
                                            <motion.span
                                                layoutId="rail-active"
                                                aria-hidden="true"
                                                className="absolute inset-0 rounded-[14px] border border-line-2 bg-veil-3"
                                                transition={{ duration: 0.45, ease: EASE }}
                                            />
                                        )}
                                        <Link
                                            to={`/chat/${convo.id}`}
                                            aria-current={active ? "page" : undefined}
                                            className={cn(
                                                "relative flex h-11 items-center rounded-[14px] pl-3.5 pr-14 text-base transition-colors duration-200",
                                                active
                                                    ? "font-medium text-ink"
                                                    : "text-ink-2 hover:bg-veil-2 hover:text-ink",
                                            )}
                                        >
                                            <span className="truncate">{title}</span>
                                        </Link>
                                        <time
                                            dateTime={convo.updated_at}
                                            className={cn(
                                                "tnum pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-micro text-ink-4 transition-opacity duration-200 group-focus-within:opacity-0 group-hover:opacity-0 pointer-coarse:hidden",
                                                armed && "opacity-0",
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
                                                "btn btn-quiet absolute right-0.5 top-1/2 h-10 -translate-y-1/2 rounded-[12px] font-medium transition-[opacity,background-color,color] duration-200 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-70",
                                                armed ? "px-3 text-sm text-ink opacity-100" : "w-10 px-0 opacity-0",
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
                        className="mx-3 mb-3 flex items-start gap-2 rounded-md border border-line-2 bg-veil-1 px-3 py-2.5 text-sm text-ink-2"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                    >
                        <AlertCircle size={15} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                        {actionError}
                    </motion.p>
                )}
            </AnimatePresence>

            <footer className="flex shrink-0 items-center gap-3 border-t border-line-1 py-2.5 pl-4 pr-2">
                <span
                    aria-hidden="true"
                    className="veil grid size-8 shrink-0 place-items-center rounded-full font-mono text-meta font-medium text-ink-2"
                >
                    {email.charAt(0).toUpperCase() || "·"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-3" title={email}>
                    {email}
                </span>
                <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    disabled={leaving}
                    aria-label="Sign out"
                    title="Sign out"
                    className="btn btn-quiet btn-icon shrink-0"
                >
                    <LogOut size={16} aria-hidden="true" />
                </button>
            </footer>
        </motion.aside>
    );
}
