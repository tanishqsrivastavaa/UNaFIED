const API_BASE = "http://localhost:8000/api/v1";

/* ── Token Management ── */

export function getAccessToken(): string | null {
    return localStorage.getItem("access_token");
}

export function getRefreshToken(): string | null {
    return localStorage.getItem("refresh_token");
}

export function setTokens(access: string, refresh: string) {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
}

/* ── Core Fetch Wrapper ── */

async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
        const res = await fetch(`${API_BASE}/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!res.ok) {
            clearTokens();
            return null;
        }

        const data = await res.json();
        setTokens(data.access_token, data.refresh_token);
        return data.access_token;
    } catch {
        clearTokens();
        return null;
    }
}

async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    let token = getAccessToken();

    const makeRequest = (t: string | null) =>
        fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(t ? { Authorization: `Bearer ${t}` } : {}),
                ...(options.headers || {}),
            },
        });

    let res = await makeRequest(token);

    // Auto-refresh on 401/403
    if ((res.status === 401 || res.status === 403) && token) {
        const newToken = await refreshAccessToken();
        if (newToken) {
            res = await makeRequest(newToken);
        } else {
            clearTokens();
            window.location.href = "/login";
            throw new Error("Session expired");
        }
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `API error ${res.status}`);
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;

    return res.json();
}

/* ── Auth ── */

export interface AuthResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

export async function signup(email: string, password: string) {
    return apiFetch<{ id: string; email: string }>("/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
}

export async function login(email: string, password: string) {
    const data = await apiFetch<AuthResponse>("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
    setTokens(data.access_token, data.refresh_token);
    return data;
}

export async function logout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
        await apiFetch("/logout", {
            method: "POST",
            body: JSON.stringify({ refresh_token: refreshToken }),
        }).catch(() => { });
    }
    clearTokens();
}

export async function getMe() {
    return apiFetch<{ id: string; email: string }>("/me");
}

/* ── Conversations ── */

export interface Conversation {
    id: string;
    title: string | null;
    created_at: string;
    updated_at: string;
}

export async function getConversations(skip = 0, limit = 20) {
    return apiFetch<{ items: Conversation[]; total: number }>(
        `/chats/?skip=${skip}&limit=${limit}`
    );
}

export async function createConversation(title?: string) {
    return apiFetch<Conversation>("/chats/", {
        method: "POST",
        body: JSON.stringify({ title: title || "New Chat" }),
    });
}

export async function deleteConversation(id: string) {
    return apiFetch<void>(`/chats/${id}`, { method: "DELETE" });
}

/* ── Messages ── */

export interface Message {
    id: string;
    conversation_id: string;
    role: "user" | "assistant";
    content: string;
    suggestion?: {
        label: string;
        tool_name: string;
        parameters: Record<string, unknown>;
    } | null;
    created_at: string;
}

export async function getConversationDetail(id: string) {
    return apiFetch<Conversation & { messages: Message[] }>(`/chats/${id}`);
}

export async function sendMessageStream(
    conversationId: string,
    content: string,
    onChunk: (text: string, suggestion?: Message["suggestion"]) => void,
    onDone: () => void
) {
    const token = getAccessToken();

    const res = await fetch(`${API_BASE}/chats/${conversationId}/stream`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content }),
    });

    if (!res.ok || !res.body) {
        throw new Error(`Stream error: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const parsed = JSON.parse(line);
                onChunk(parsed.chat_message || "", parsed.suggestion || null);
            } catch {
                // skip malformed lines
            }
        }
    }

    onDone();
}

/* ── Tools ── */

export async function executeTool(toolName: string, parameters: Record<string, unknown>) {
    return apiFetch<{ tool_name: string; result: string }>("/tools/execute", {
        method: "POST",
        body: JSON.stringify({ tool_name: toolName, parameters }),
    });
}
