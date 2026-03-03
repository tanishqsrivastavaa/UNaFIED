import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import {
    getConversations,
    createConversation,
    deleteConversation,
    type Conversation,
} from "../../lib/api";

export default function ChatList() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { conversationId } = useParams();

    const fetchConversations = async () => {
        try {
            const data = await getConversations();
            setConversations(data.items);
        } catch {
            // silently fail — user will see empty list
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    const handleNew = async () => {
        try {
            const newConvo = await createConversation();
            setConversations((prev) => [newConvo, ...prev]);
            navigate(`/chat/${newConvo.id}`);
        } catch {
            // handled
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            await deleteConversation(id);
            setConversations((prev) => prev.filter((c) => c.id !== id));
            if (conversationId === id) navigate("/chat");
        } catch {
            // handled
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
        <div className="chatlist">
            <div className="chatlist-header">
                <h2>Chats</h2>
                <button className="chatlist-new" onClick={handleNew} title="New Chat">
                    <Plus size={18} />
                </button>
            </div>

            <div className="chatlist-items">
                {loading ? (
                    <p className="chatlist-empty">Loading…</p>
                ) : conversations.length === 0 ? (
                    <p className="chatlist-empty">No conversations yet</p>
                ) : (
                    conversations.map((convo) => (
                        <button
                            key={convo.id}
                            className={`chatlist-item ${conversationId === convo.id ? "active" : ""}`}
                            onClick={() => navigate(`/chat/${convo.id}`)}
                        >
                            <div className="chatlist-item-content">
                                <span className="chatlist-title">{convo.title || "New Chat"}</span>
                                <span className="chatlist-time">{timeAgo(convo.updated_at)}</span>
                            </div>
                            <button
                                className="chatlist-delete"
                                onClick={(e) => handleDelete(e, convo.id)}
                                title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                        </button>
                    ))
                )}
            </div>

            <style>{`
        .chatlist {
          width: 280px;
          min-width: 280px;
          height: 100vh;
          border-right: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          background: #fff;
        }
        .chatlist-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1rem;
          border-bottom: 1px solid var(--color-border);
        }
        .chatlist-header h2 {
          font-size: 1.1rem;
        }
        .chatlist-new {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-pill);
          border: none;
          background: var(--color-accent);
          color: #111;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, transform 0.1s;
        }
        .chatlist-new:hover {
          background: var(--color-accent-hover);
        }
        .chatlist-new:active {
          transform: scale(0.93);
        }
        .chatlist-items {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem;
        }
        .chatlist-empty {
          text-align: center;
          color: var(--color-text-muted);
          font-size: 0.85rem;
          padding: 2rem 1rem;
        }
        .chatlist-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 0.75rem;
          border: none;
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          transition: background 0.12s;
          font-family: var(--font-sans);
        }
        .chatlist-item:hover {
          background: #f5f5f5;
        }
        .chatlist-item.active {
          background: #f0f0f0;
          border-left: 3px solid var(--color-accent);
        }
        .chatlist-item-content {
          flex: 1;
          min-width: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .chatlist-title {
          font-size: 0.85rem;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 160px;
        }
        .chatlist-time {
          font-size: 0.7rem;
          color: var(--color-text-muted);
          flex-shrink: 0;
        }
        .chatlist-delete {
          background: none;
          border: none;
          color: transparent;
          cursor: pointer;
          padding: 0.2rem;
          border-radius: 4px;
          display: flex;
          transition: color 0.15s;
        }
        .chatlist-item:hover .chatlist-delete {
          color: #bbb;
        }
        .chatlist-delete:hover {
          color: #d44 !important;
        }
      `}</style>
        </div>
    );
}
