import { API_BASE, getAccessToken } from "./api";

const WS_BASE = API_BASE.replace(/^http/, "ws");
const BASE_DELAY = 400;
const MAX_DELAY = 8000;

export type SocketStatus = "connecting" | "online" | "offline";

export interface ServerEvent {
    type: string;
    data: Record<string, unknown>;
}

interface Entry {
    /** Server path after /api/v1, e.g. /chats/<id>/ws, or /ws for the app-wide socket. */
    path: string;
    socket: WebSocket | null;
    onMessage: (event: ServerEvent) => void;
    onStatus: (status: SocketStatus) => void;
    attempts: number;
    timer: number | null;
    closed: boolean;
}

const entries = new Map<string, Entry>();

function retryDelay(attempts: number) {
    return Math.min(MAX_DELAY, BASE_DELAY * 2 ** attempts) * (0.7 + Math.random() * 0.6);
}

function emit(entry: Entry, event: ServerEvent) {
    if (entry.closed) return;
    entry.onMessage(event);
}

function schedule(id: string, entry: Entry) {
    if (entry.closed || entry.timer !== null) return;
    const wait = retryDelay(entry.attempts);
    entry.attempts += 1;
    entry.timer = window.setTimeout(() => {
        entry.timer = null;
        connect(id, entry);
    }, wait);
}

function connect(id: string, entry: Entry) {
    const token = getAccessToken();
    if (!token) {
        schedule(id, entry);
        return;
    }

    entry.onStatus("connecting");

    const socket = new WebSocket(`${WS_BASE}${entry.path}?token=${encodeURIComponent(token)}`);
    entry.socket = socket;

    socket.onopen = () => {
        const reconnected = entry.attempts > 0;
        entry.attempts = 0;
        entry.onStatus("online");
        if (reconnected) emit(entry, { type: "socket_reconnected", data: {} });
    };

    socket.onmessage = (message) => {
        try {
            emit(entry, JSON.parse(message.data) as ServerEvent);
        } catch {
            return;
        }
    };

    socket.onclose = () => {
        entry.socket = null;
        if (entry.closed) return;
        entry.onStatus("offline");
        schedule(id, entry);
    };

    socket.onerror = () => socket.close();
}

export function openSocket(
    id: string,
    onMessage: (event: ServerEvent) => void,
    onStatus: (status: SocketStatus) => void,
    path = `/chats/${id}/ws`,
) {
    closeSocket(id);
    const entry: Entry = { path, socket: null, onMessage, onStatus, attempts: 0, timer: null, closed: false };
    entries.set(id, entry);
    connect(id, entry);
}

export function closeSocket(id: string) {
    const entry = entries.get(id);
    if (!entry) return;
    entry.closed = true;
    if (entry.timer !== null) window.clearTimeout(entry.timer);
    entry.socket?.close();
    entries.delete(id);
}

export function closeAllSockets() {
    for (const id of [...entries.keys()]) closeSocket(id);
}

export function isOpen(id: string) {
    return entries.get(id)?.socket?.readyState === WebSocket.OPEN;
}

export function send(id: string, type: string, data: Record<string, unknown>) {
    const socket = entries.get(id)?.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type, data }));
    return true;
}
