import { create } from "zustand";
import {
    login as apiLogin,
    signup as apiSignup,
    logout as apiLogout,
    getMe,
    getAccessToken,
    clearTokens,
} from "../lib/api";

interface User {
    id: string;
    email: string;
}

interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;

    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,
    error: null,

    login: async (email, password) => {
        set({ loading: true, error: null });
        try {
            await apiLogin(email, password);
            const user = await getMe();
            set({ user, loading: false });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Login failed";
            set({ error: message, loading: false });
            throw err;
        }
    },

    signup: async (email, password) => {
        set({ loading: true, error: null });
        try {
            await apiSignup(email, password);
            await apiLogin(email, password);
            const user = await getMe();
            set({ user, loading: false });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Signup failed";
            set({ error: message, loading: false });
            throw err;
        }
    },

    logout: async () => {
        await apiLogout();
        set({ user: null, loading: false, error: null });
    },

    hydrate: async () => {
        const token = getAccessToken();
        if (!token) {
            set({ user: null, loading: false });
            return;
        }
        try {
            const user = await getMe();
            set({ user, loading: false });
        } catch {
            clearTokens();
            set({ user: null, loading: false });
        }
    },
}));
