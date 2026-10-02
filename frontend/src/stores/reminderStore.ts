import { create } from "zustand";
import { getReminders, updateReminder, type Reminder, type ReminderChanges } from "../lib/api";
import { serverDate } from "../lib/time";

/** An alert still shows if the app opens up to this long after the reminder's time. */
const GRACE_MS = 5 * 60_000;
const ALERTED_KEY = "unafied:alerted";

/** Reminders already alerted. Kept in memory too, so blocked storage can't cause repeats. */
const alerted = new Set<string>();

/** Keyed by time as well, so a reminder moved after its alert alerts again at the new time. */
const alertKey = (r: Reminder) => `${r.id}@${serverDate(r.due_at).getTime()}`;

const byTime = (a: Reminder, b: Reminder) => serverDate(a.due_at).getTime() - serverDate(b.due_at).getTime();

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
    update: (id: string, changes: ReminderChanges) => Promise<void>;
    /**
     * Raises an alert for each reminder the server has sent (at the person's lead time)
     * that this browser hasn't shown yet, unless its time is long past.
     */
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

    update: async (id, changes) => {
        const updated = await updateReminder(id, changes);
        set((s) => ({
            reminders: s.reminders.map((r) => (r.id === id ? updated : r)).sort(byTime),
            // An alert only stands while its reminder is still sent: removing or moving it clears the alert.
            alerts: s.alerts.flatMap((a) => (a.id !== id ? [a] : updated.status === "sent" ? [updated] : [])),
        }));
    },

    check: (now) => {
        syncAlerted();
        const due = get().reminders.filter((r) => {
            const at = serverDate(r.due_at).getTime();
            return r.status === "sent" && !alerted.has(alertKey(r)) && now <= at + GRACE_MS;
        });
        if (due.length === 0) return;
        syncAlerted(due.map(alertKey));
        set((s) => ({ alerts: [...s.alerts, ...due] }));
        due.forEach(notify);
    },

    dismissAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),

    reset: () => set({ reminders: [], loaded: false, alerts: [] }),
}));
