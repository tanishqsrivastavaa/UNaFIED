import { create } from "zustand";
import { getReminders, updateReminder, type Reminder } from "../lib/api";
import { serverDate } from "../lib/time";

/** Alert this long before a reminder is due. */
export const LEAD_MS = 15 * 60_000;
/** Still worth alerting this late, e.g. when the app opens just after the lead time. */
const GRACE_MS = 5 * 60_000;
const ALERTED_KEY = "unafied:alerted";

/** Reminders already alerted. Kept in memory too, so blocked storage can't cause repeats. */
const alerted = new Set<string>();

function syncAlerted(add: string[] = []) {
    try {
        const stored: string[] = JSON.parse(localStorage.getItem(ALERTED_KEY) ?? "[]");
        stored.forEach((id) => alerted.add(id));
        add.forEach((id) => alerted.add(id));
        if (add.length) localStorage.setItem(ALERTED_KEY, JSON.stringify([...alerted]));
    } catch {
        add.forEach((id) => alerted.add(id));
    }
}

function notify(reminder: Reminder) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const time = serverDate(reminder.due_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    // The tag makes a second tab replace this notification instead of stacking another.
    new Notification(reminder.title, { body: `At ${time}`, tag: reminder.id });
}

interface ReminderState {
    reminders: Reminder[];
    /** False until the first load lands, so cards don't show a wrong state. */
    loaded: boolean;
    /** Reminders whose in-app alert is showing. */
    alerts: Reminder[];
    load: () => Promise<void>;
    /** Throws on failure; the list is untouched then. */
    setStatus: (id: string, status: "confirmed" | "dismissed") => Promise<void>;
    /** Raises an alert for each confirmed reminder that is now within the lead time. */
    check: (now: number) => void;
    dismissAlert: (id: string) => void;
    reset: () => void;
}

export const useReminderStore = create<ReminderState>((set, get) => ({
    reminders: [],
    loaded: false,
    alerts: [],

    load: async () => {
        try {
            const reminders = await getReminders();
            set({ reminders, loaded: true });
        } catch {
            // Keep what we have; the next poll tries again.
        }
    },

    setStatus: async (id, status) => {
        const updated = await updateReminder(id, { status });
        set((s) => ({
            reminders: s.reminders.map((r) => (r.id === id ? updated : r)),
            alerts: status === "dismissed" ? s.alerts.filter((a) => a.id !== id) : s.alerts,
        }));
    },

    check: (now) => {
        syncAlerted();
        const due = get().reminders.filter((r) => {
            const at = serverDate(r.due_at).getTime();
            return r.status === "confirmed" && !alerted.has(r.id) && now >= at - LEAD_MS && now <= at + GRACE_MS;
        });
        if (due.length === 0) return;
        syncAlerted(due.map((r) => r.id));
        set((s) => ({ alerts: [...s.alerts, ...due] }));
        due.forEach(notify);
    },

    dismissAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),

    reset: () => set({ reminders: [], loaded: false, alerts: [] }),
}));
