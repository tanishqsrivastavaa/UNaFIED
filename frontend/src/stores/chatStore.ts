import { create } from "zustand";
import {
    createConversation,
    deleteConversation,
    getConversationDetail,
    getConversations,
    inviteParticipant,
    leaveConversation,
    markRead,
    removeParticipant,
    sendMessageStream,
    startDirectChat,
    type Conversation,
    type Message,
    type Participant,
} from "../lib/api";
import { readableReply } from "../lib/reply";
import {
    closeAllSockets,
    closeSocket,
    openSocket,
    send as wsSend,
    type ServerEvent,
    type SocketStatus,
} from "../lib/ws";
import { useAuthStore } from "./authStore";
import { useReminderStore } from "./reminderStore";

type ListState = "loading" | "ready" | "error";
export type LoadState = "loading" | "ready" | "error";

export interface Peer {
    userId: string;
    email: string;
}

export interface Typing {
    userId: string;
    email: string;
    at: number;
}

const NOT_SENT = "Your message didn't send, so it's back in the box.";
/** Key of the app-wide socket among the per-conversation ones. */
const APP_SOCKET = "app";
const NO_REPLY = "UNaFIED didn't reply. Send a follow-up to try again.";

export const freshConversations = new Set<string>();

/** Conversations with a live socket, so a late load can't open one after close. */
const active = new Set<string>();

/** Conversations you are leaving here, whose own removal event isn't news. */
const leaving = new Set<string>();

/** At most one "read" call per conversation this often while messages keep arriving. */
const READ_EVERY = 1500;
const readTimers = new Map<string, number>();

function readNow(id: string) {
    window.clearTimeout(readTimers.get(id));
    readTimers.delete(id);
    void markRead(id).catch(() => undefined);
}

function readSoon(id: string) {
    if (!readTimers.has(id)) readTimers.set(id, window.setTimeout(() => readNow(id), READ_EVERY));
}

interface Pending {
    localId: string;
    content: string;
    resolve: (ok: boolean) => void;
}

interface ChatState {
    conversations: Conversation[];
    listState: ListState;

    messages: Record<string, Message[]>;
    loadState: Record<string, LoadState>;
    /** Raw reply text while the agent is writing, null when idle. */
    streaming: Record<string, string | null>;
    notice: Record<string, string | null>;
    typing: Record<string, Typing[]>;
    peers: Record<string, Peer[]>;
    /** Everyone ever added to the conversation; `is_active` is false for people who left. */
    participants: Record<string, Participant[]>;
    status: Record<string, SocketStatus>;
    typingSent: Record<string, boolean>;
    pending: Record<string, Pending | null>;
    /** Conversations with new messages since they were last open; seeded from the server's list. */
    unread: Record<string, boolean>;
    /** Threads you were taken out of while they were open. */
    removed: Record<string, boolean>;

    load: () => Promise<void>;
    /** Creates a conversation and puts it at the top of the list. Throws on failure. */
    create: () => Promise<Conversation>;
    /** Deletes a conversation. Throws on failure; the list is untouched then. */
    remove: (id: string) => Promise<void>;
    /** Keep the list in step with a title the thread learned from the server. */
    syncTitle: (id: string, title: string | null) => void;

    openThread: (id: string) => void;
    closeThread: (id: string) => void;
    loadThread: (id: string) => Promise<void>;
    send: (id: string, content: string) => Promise<boolean>;
    /** Tells the others you are (still) typing, or stopped. The caller paces the repeats. */
    setTyping: (id: string, isTyping: boolean) => void;
    /** Adds someone by email. Throws with the server's reason on failure. */
    invite: (id: string, email: string) => Promise<void>;
    /** Takes you out of the conversation and drops it from your list. Throws with the server's reason. */
    leave: (id: string) => Promise<void>;
    /** Owner only. Throws with the server's reason on failure. */
    removeMember: (id: string, userId: string) => Promise<void>;
    /** Opens (or starts) your chat with one person. Throws with the server's reason on failure. */
    direct: (email: string) => Promise<Conversation>;
    /** Listens for what happens outside the open thread: activity elsewhere, new conversations, reminders. */
    startAppSocket: () => void;
    stopAppSocket: () => void;
    reset: () => void;
}

/** Adds or re-activates one person without duplicating them. */
function withMember(list: Participant[] = [], member: Participant): Participant[] {
    return [...list.filter((p) => p.user_id !== member.user_id), member];
}

function assistantRow(content: string, suggestion: Message["suggestion"]): Message {
    return {
        id: `local-reply-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sender_id: null,
        role: "assistant",
        content,
        suggestion,
        is_proactive: false,
        created_at: new Date().toISOString(),
    };
}

export const useChatStore = create<ChatState>((set, get) => {
    const refresh = async (id: string) => {
        const data = await getConversationDetail(id);
        set((s) => ({
            messages: { ...s.messages, [id]: data.messages ?? [] },
            participants: { ...s.participants, [id]: data.participants ?? [] },
        }));
        get().syncTitle(id, data.title);
        readNow(id); // only an open thread refreshes, so what it just fetched has been seen
    };

    /**
     * A send that failed for an unknown reason. Asks the server what it kept before
     * deciding what to tell the person, rather than guessing from the client side.
     */
    const reconcile = async (id: string, pending: Pending) => {
        try {
            const data = await getConversationDetail(id);
            const list = data.messages ?? [];
            const last = list[list.length - 1];
            const kept = last?.role === "user" && last.content === pending.content;
            set((s) => ({
                messages: { ...s.messages, [id]: list },
                loadState: { ...s.loadState, [id]: "ready" },
                streaming: { ...s.streaming, [id]: null },
                pending: { ...s.pending, [id]: null },
                notice: { ...s.notice, [id]: kept ? NO_REPLY : NOT_SENT },
            }));
            get().syncTitle(id, data.title);
            pending.resolve(kept);
        } catch {
            set((s) => ({
                messages: {
                    ...s.messages,
                    [id]: (s.messages[id] ?? []).filter((m) => m.id !== pending.localId),
                },
                streaming: { ...s.streaming, [id]: null },
                pending: { ...s.pending, [id]: null },
                notice: { ...s.notice, [id]: NOT_SENT },
            }));
            pending.resolve(false);
        }
    };

    /** The no-socket path: the HTTP stream the app used before sockets existed. */
    const sendOverHttp = async (id: string, content: string, pending: Pending) => {
        let raw = "";
        set((s) => ({ streaming: { ...s.streaming, [id]: "" } }));
        try {
            await sendMessageStream(
                id,
                content,
                (chunk) => {
                    raw += chunk;
                    set((s) => ({ streaming: { ...s.streaming, [id]: raw } }));
                },
                () => {}
            );
        } catch {
            await reconcile(id, pending);
            return;
        }

        set((s) => ({
            // A shared conversation streams nothing back unless someone mentions the assistant
            messages: raw
                ? { ...s.messages, [id]: [...(s.messages[id] ?? []), assistantRow(readableReply(raw), null)] }
                : s.messages,
            streaming: { ...s.streaming, [id]: null },
            pending: { ...s.pending, [id]: null },
        }));
        pending.resolve(true);
        void refresh(id).catch(() => undefined);
    };

    const apply = (id: string, event: ServerEvent) => {
        switch (event.type) {
            case "message": {
                const message = event.data as unknown as Message;
                const me = useAuthStore.getState().user?.id;
                const pending = get().pending[id];
                let settled = false;
                set((s) => {
                    const list = s.messages[id] ?? [];
                    if (list.some((m) => m.id === message.id)) return s;
                    const mine =
                        pending && s.pending[id] === pending && message.sender_id === me && message.content === pending.content;
                    settled = !!mine;
                    return {
                        ...s,
                        messages: {
                            ...s.messages,
                            [id]: mine
                                ? list.map((m) => (m.id === pending.localId ? message : m))
                                : [...list, message],
                        },
                        pending: mine ? { ...s.pending, [id]: null } : s.pending,
                        // Their message is what the dots were promising; a late "stopped" may never come
                        typing: { ...s.typing, [id]: (s.typing[id] ?? []).filter((t) => t.userId !== message.sender_id) },
                    };
                });
                // The server has the message, so the send is done; a reply, if any, arrives separately
                if (settled && pending) pending.resolve(true);
                readSoon(id); // seen as it lands, so it stays read after a reload
                break;
            }

            case "stream_start": {
                set((s) => ({ ...s, streaming: { ...s.streaming, [id]: "" } }));
                break;
            }

            case "stream_chunk": {
                const { content } = event.data as { content: string };
                if (!content) break;
                set((s) => {
                    if (s.streaming[id] === null) return s;
                    return { ...s, streaming: { ...s.streaming, [id]: (s.streaming[id] ?? "") + content } };
                });
                break;
            }

            case "stream_end": {
                const data = event.data as { full_content: string; suggestion?: Message["suggestion"] };
                const pending = get().pending[id];
                let accepted = false;
                set((s) => {
                    if (s.streaming[id] === null) return s;
                    accepted = true;
                    return {
                        ...s,
                        messages: {
                            ...s.messages,
                            [id]: [...(s.messages[id] ?? []), assistantRow(readableReply(data.full_content), data.suggestion ?? null)],
                        },
                        streaming: { ...s.streaming, [id]: null },
                        pending: { ...s.pending, [id]: null },
                    };
                });
                if (accepted && pending) pending.resolve(true);
                if (accepted) readSoon(id);
                break;
            }

            case "typing": {
                const data = event.data as { user_id: string; email: string; is_typing: boolean };
                set((s) => {
                    const rest = (s.typing[id] ?? []).filter((t) => t.userId !== data.user_id);
                    const entry: Typing = { userId: data.user_id, email: data.email, at: Date.now() };
                    return {
                        ...s,
                        typing: { ...s.typing, [id]: data.is_typing ? [...rest, entry] : rest },
                    };
                });
                break;
            }

            case "user_joined": {
                const data = event.data as { user_id: string; email: string };
                set((s) => {
                    const list = s.peers[id] ?? [];
                    if (list.some((p) => p.userId === data.user_id)) return s;
                    return { ...s, peers: { ...s.peers, [id]: [...list, { userId: data.user_id, email: data.email }] } };
                });
                break;
            }

            case "user_left": {
                const { user_id } = event.data as { user_id: string };
                set((s) => ({
                    ...s,
                    peers: { ...s.peers, [id]: (s.peers[id] ?? []).filter((p) => p.userId !== user_id) },
                }));
                break;
            }

            case "participant_added": {
                const { user_id, email } = event.data as { user_id: string; email: string };
                set((s) => ({
                    ...s,
                    participants: { ...s.participants, [id]: withMember(s.participants[id], { user_id, email, is_active: true }) },
                }));
                break;
            }

            case "participant_removed": {
                const { user_id, owner_id } = event.data as { user_id: string; owner_id?: string };
                if (user_id === useAuthStore.getState().user?.id) {
                    if (leaving.has(id)) break; // you left from here; the panel takes you out
                    get().closeThread(id);
                    set((s) => ({
                        removed: { ...s.removed, [id]: true },
                        conversations: s.conversations.filter((c) => c.id !== id),
                    }));
                    break;
                }
                set((s) => ({
                    ...s,
                    participants: {
                        ...s.participants,
                        [id]: (s.participants[id] ?? []).map((p) => ({
                            ...p,
                            is_active: p.is_active && p.user_id !== user_id,
                            role: owner_id ? (p.user_id === owner_id ? "owner" : "member") : p.role,
                        })),
                    },
                    peers: { ...s.peers, [id]: (s.peers[id] ?? []).filter((p) => p.userId !== user_id) },
                    typing: { ...s.typing, [id]: (s.typing[id] ?? []).filter((t) => t.userId !== user_id) },
                }));
                break;
            }

            case "error": {
                const { message } = event.data as { message?: string };
                const pending = get().pending[id];
                if (pending) {
                    void reconcile(id, pending);
                } else {
                    set((s) => ({
                        ...s,
                        streaming: { ...s.streaming, [id]: null },
                        notice: { ...s.notice, [id]: message ?? null },
                    }));
                }
                break;
            }

            case "socket_reconnected": {
                const pending = get().pending[id];
                if (pending) void reconcile(id, pending);
                else void refresh(id).catch(() => undefined);
                break;
            }

            default:
                break;
        }
    };

    return {
        conversations: [],
        listState: "loading",
        messages: {},
        loadState: {},
        streaming: {},
        notice: {},
        typing: {},
        peers: {},
        participants: {},
        status: {},
        typingSent: {},
        pending: {},
        unread: {},
        removed: {},

        load: async () => {
            if (get().conversations.length === 0) set({ listState: "loading" });
            try {
                const data = await getConversations(0, 50);
                set((s) => ({
                    conversations: data.items,
                    listState: "ready",
                    // The server remembers what you've read; the open thread is read by definition
                    unread: {
                        ...s.unread,
                        ...Object.fromEntries(data.items.map((c) => [c.id, !!c.unread && !active.has(c.id)])),
                    },
                }));
            } catch {
                set({ listState: "error" });
            }
        },

        create: async () => {
            const convo = await createConversation("New conversation");
            freshConversations.add(convo.id);
            set((s) => ({ conversations: [convo, ...s.conversations], listState: "ready" }));
            return convo;
        },

        remove: async (id) => {
            await deleteConversation(id);
            set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) }));
        },

        syncTitle: (id, title) => {
            const hit = get().conversations.find((c) => c.id === id);
            if (!hit || hit.title === title) return;
            set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)) }));
        },

        openThread: (id) => {
            active.add(id);
            set((s) => ({ unread: { ...s.unread, [id]: false }, removed: { ...s.removed, [id]: false } }));

            const begin = () => {
                if (!active.has(id)) return;
                openSocket(
                    id,
                    (event) => apply(id, event),
                    (status) => set((s) => ({ status: { ...s.status, [id]: status } }))
                );
            };

            if (freshConversations.has(id)) {
                set((s) => ({ messages: { ...s.messages, [id]: [] }, loadState: { ...s.loadState, [id]: "ready" } }));
                begin();
                return;
            }

            // Load first, then open: an event landing mid-fetch would be overwritten
            // by the fetch result, since both write the same array.
            void get().loadThread(id).finally(begin);
        },

        closeThread: (id) => {
            active.delete(id);
            closeSocket(id);
            if (readTimers.has(id)) readNow(id); // don't lose a read that was waiting
            get().pending[id]?.resolve(false);
            set((s) => ({
                streaming: { ...s.streaming, [id]: null },
                pending: { ...s.pending, [id]: null },
                notice: { ...s.notice, [id]: null },
                typing: { ...s.typing, [id]: [] },
                peers: { ...s.peers, [id]: [] },
                status: { ...s.status, [id]: "connecting" },
                typingSent: { ...s.typingSent, [id]: false },
            }));
        },

        loadThread: async (id) => {
            set((s) => ({ loadState: { ...s.loadState, [id]: "loading" } }));
            try {
                await refresh(id);
                set((s) => ({ loadState: { ...s.loadState, [id]: "ready" } }));
            } catch {
                set((s) => ({ loadState: { ...s.loadState, [id]: "error" } }));
            }
        },

        send: (id, content) =>
            new Promise<boolean>((resolve) => {
                freshConversations.delete(id);
                const me = useAuthStore.getState().user?.id ?? null;
                const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                const pending: Pending = { localId, content, resolve };

                set((s) => ({
                    messages: {
                        ...s.messages,
                        [id]: [
                            ...(s.messages[id] ?? []),
                            {
                                id: localId,
                                sender_id: me,
                                role: "user",
                                content,
                                suggestion: null,
                                is_proactive: false,
                                created_at: new Date().toISOString(),
                            },
                        ],
                    },
                    notice: { ...s.notice, [id]: null },
                    pending: { ...s.pending, [id]: pending },
                }));

                if (!wsSend(id, "message", { content })) {
                    void sendOverHttp(id, content, pending);
                }
            }),

        setTyping: (id, isTyping) => {
            // A repeated "typing" is a heartbeat that keeps it alive on the other side; a repeated "stopped" is noise.
            if (!isTyping && !(get().typingSent[id] ?? false)) return;
            set((s) => ({ typingSent: { ...s.typingSent, [id]: isTyping } }));
            wsSend(id, "typing", { is_typing: isTyping });
        },

        invite: async (id, email) => {
            const added = await inviteParticipant(id, email);
            set((s) => ({ participants: { ...s.participants, [id]: withMember(s.participants[id], added) } }));
        },

        leave: async (id) => {
            leaving.add(id);
            try {
                await leaveConversation(id);
                get().closeThread(id);
                set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) }));
            } finally {
                leaving.delete(id);
            }
        },

        removeMember: async (id, userId) => {
            await removeParticipant(id, userId);
            set((s) => ({
                participants: {
                    ...s.participants,
                    [id]: (s.participants[id] ?? []).map((p) => (p.user_id === userId ? { ...p, is_active: false } : p)),
                },
            }));
        },

        direct: async (email) => {
            const convo = await startDirectChat(email);
            set((s) => ({ conversations: [convo, ...s.conversations.filter((c) => c.id !== convo.id)], listState: "ready" }));
            return convo;
        },

        startAppSocket: () => {
            const reminders = () => void useReminderStore.getState().load();
            openSocket(
                APP_SOCKET,
                (event) => {
                    switch (event.type) {
                        case "conversation_activity": {
                            const id = String(event.data.conversation_id);
                            if (!active.has(id)) set((s) => ({ unread: { ...s.unread, [id]: true } }));
                            void get().load(); // the list is ordered by latest activity
                            break;
                        }
                        case "conversations_changed":
                            void get().load();
                            break;
                        case "reminders_changed":
                        case "reminder_due":
                            reminders();
                            break;
                        case "socket_reconnected":
                            void get().load();
                            reminders();
                            break;
                    }
                },
                () => {},
                "/ws",
            );
        },

        stopAppSocket: () => closeSocket(APP_SOCKET),

        reset: () => {
            closeAllSockets();
            active.clear();
            freshConversations.clear();
            for (const timer of readTimers.values()) window.clearTimeout(timer);
            readTimers.clear();
            set({
                conversations: [],
                listState: "loading",
                messages: {},
                loadState: {},
                streaming: {},
                notice: {},
                typing: {},
                peers: {},
                participants: {},
                status: {},
                typingSent: {},
                pending: {},
                unread: {},
                removed: {},
            });
        },
    };
});
