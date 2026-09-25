/**
 * The API stores naive timestamps (`datetime.now()` on a UTC host) with no
 * zone marker. `new Date()` would read those as local time, so treat any
 * zone-less value as UTC.
 */
export function serverDate(value: string): Date {
    const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value);
    return new Date(hasZone ? value : `${value}Z`);
}

export function clock(value: string): string {
    return serverDate(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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
