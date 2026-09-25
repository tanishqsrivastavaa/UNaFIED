import { create } from "zustand";
import {
    createConversation,
    deleteConversation,
    getConversations,
    type Conversation,
} from "../lib/api";

type ListState = "loading" | "ready" | "error";

/**
 * Conversations created in this session that have had nothing sent yet. They
 * are known to be empty, so a thread can open them without waiting on a fetch.
 */
export const freshConversations = new Set<string>();

interface ChatState {
    conversations: Conversation[];
    listState: ListState;

    load: () => Promise<void>;
    /** Creates a conversation and puts it at the top of the list. Throws on failure. */
    create: () => Promise<Conversation>;
    /** Deletes a conversation. Throws on failure; the list is untouched then. */
    remove: (id: string) => Promise<void>;
    /** Keep the list in step with a title the thread learned from the server. */
    syncTitle: (id: string, title: string | null) => void;
    reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
    conversations: [],
    listState: "loading",

    load: async () => {
        if (get().conversations.length === 0) set({ listState: "loading" });
        try {
            const data = await getConversations(0, 50);
            set({ conversations: data.items, listState: "ready" });
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

    reset: () => set({ conversations: [], listState: "loading" }),
}));
