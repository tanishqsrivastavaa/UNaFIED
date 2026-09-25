import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, MessageSquare, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  getConversations,
  createConversation,
  deleteConversation,
  type Conversation,
} from "../../lib/api";

export default function ChatList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { conversationId } = useParams();

  const fetchConversations = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await getConversations();
      setConversations(data.items);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const handleNew = async () => {
    setCreating(true);
    setActionError(null);
    try {
      const newConvo = await createConversation();
      setConversations((prev) => [newConvo, ...prev]);
      navigate(`/chat/${newConvo.id}`);
    } catch {
      setActionError("Couldn't create a conversation.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    setActionError(null);
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) navigate("/chat");
    } catch {
      setActionError("Couldn't delete that conversation.");
    } finally {
      setDeletingId(null);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <section
      aria-label="Conversations"
      className={`h-full w-full shrink-0 flex-col border-r border-edge-hairline bg-pane-1/60 backdrop-blur-2xl sm:flex sm:w-80 ${
        conversationId ? "hidden" : "flex"
      }`}
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <div>
          <p className="text-micro font-medium uppercase tracking-[0.16em] text-ink-quiet">Workspace</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink-bright">Conversations</h2>
        </div>
        <button
          type="button"
          aria-label="Create a new chat"
          title="New chat"
          onClick={handleNew}
          disabled={creating || deletingId !== null}
          className="btn btn-ghost size-9 p-0 disabled:cursor-not-allowed"
        >
          <Plus size={17} className={creating ? "opacity-40" : ""} aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="space-y-1.5 pt-1" role="status" aria-live="polite">
            <span className="sr-only">Loading conversations…</span>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex h-12 items-center gap-3 px-3" aria-hidden="true">
                <span className="h-2.5 w-2/5 rounded-pill bg-frost-2" />
                <span className="ml-auto h-2 w-8 rounded-pill bg-frost-1" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="glass-1 m-1 rounded-lg p-4 text-center" role="alert">
            <AlertCircle size={18} className="mx-auto text-ink-soft" aria-hidden="true" />
            <p className="mt-2.5 text-sm font-semibold text-ink">Conversations unavailable</p>
            <p className="mt-1 text-meta leading-5 text-ink-quiet">
              The list could not be loaded.
            </p>
            <button
              type="button"
              className="btn btn-ghost mt-3 h-9"
              onClick={fetchConversations}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Retry
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="glass-1 m-1 rounded-lg p-5 text-center">
            <MessageSquare size={18} className="mx-auto text-ink-soft" aria-hidden="true" />
            <p className="mt-2.5 text-sm font-semibold text-ink">No conversations yet</p>
            <p className="mt-1 text-meta leading-5 text-ink-quiet">
              Your quiet space for things in motion.
            </p>
          </div>
        ) : (
          <div role="list" aria-label="Conversation list" className="space-y-0.5">
            {conversations.map((convo) => {
              const isSelected = conversationId === convo.id;
              const title = convo.title || "New Chat";
              const isDeleting = deletingId === convo.id;

              return (
                <div
                  key={convo.id}
                  role="listitem"
                  className={`group relative flex items-center rounded-md transition-colors duration-150 ease-glass ${
                    isSelected ? "bg-frost-2" : "hover:bg-frost-1"
                  }`}
                >
                  {isSelected && (
                    <span
                      className="absolute inset-y-2 left-0 w-0.5 rounded-pill bg-presence"
                      aria-hidden="true"
                    />
                  )}
                  <button
                    type="button"
                    aria-current={isSelected ? "page" : undefined}
                    onClick={() => navigate(`/chat/${convo.id}`)}
                    disabled={deletingId !== null}
                    className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-md py-0 pl-4 pr-2 text-left disabled:cursor-not-allowed"
                  >
                    <span
                      className={`min-w-0 flex-1 truncate text-base ${
                        isSelected ? "font-semibold text-ink-bright" : "font-medium text-ink"
                      }`}
                    >
                      {title}
                    </span>
                    <time dateTime={convo.updated_at} className="tnum shrink-0">
                      {timeAgo(convo.updated_at)}
                    </time>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${title}`}
                    title="Delete conversation"
                    aria-busy={isDeleting}
                    onClick={(e) => handleDelete(e, convo.id)}
                    disabled={deletingId !== null}
                    className="btn btn-quiet mr-1 size-8 shrink-0 p-0 opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={14} className={isDeleting ? "opacity-40" : ""} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {actionError && (
        <div className="mx-3 mb-3 flex items-start gap-2 rounded-md border border-edge-hairline bg-frost-1 px-3 py-2" role="alert">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-ink-soft" aria-hidden="true" />
          <p className="text-meta leading-5 text-ink-soft">{actionError}</p>
        </div>
      )}
    </section>
  );
}
