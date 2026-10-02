/**
 * The API stores naive timestamps (`datetime.now()` on a UTC host) with no
 * zone marker. `new Date()` would read those as local time, so treat any
 * zone-less value as UTC.
 */
export function serverDate(value: string): Date {
    const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value);
    return new Date(hasZone ? value : `${value}Z`);
}

/**
 * A server time as a `datetime-local` value ("2026-10-02T16:00") in the browser's zone.
 * `new Date(thatValue)` reads it back as local time.
 */
export function localInput(value: string): string {
    const at = serverDate(value);
    return new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function clock(value: string): string {
    return serverDate(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** A moment ahead, the way people say it: "Today 4:00 PM", "Tomorrow 9:00 AM", "Fri 2 Oct, 4:00 PM". */
export function when(value: string, now: number): string {
    const at = serverDate(value);
    const time = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const days = Math.round((startOfDay(at) - startOfDay(new Date(now))) / 86_400_000);
    if (days === 0) return `Today ${time}`;
    if (days === 1) return `Tomorrow ${time}`;
    return `${at.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

function startOfDay(at: Date): number {
    return new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
}

export function ago(value: string, now: number): string {
    const mins = Math.floor((now - serverDate(value).getTime()) / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return serverDate(value).toLocaleDateString([], { month: "short", day: "numeric" });
}
