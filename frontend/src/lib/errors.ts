/** Turn transport and API errors into sentences a person can act on. */
export function plainError(err: unknown, fallback: string): string {
    const message = err instanceof Error ? err.message : "";
    if (!message) return fallback;
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
        return "Can't reach UNaFIED right now. Check your connection and try again.";
    }
    if (/^API error \d+$/.test(message) || /^Stream error/.test(message)) return fallback;
    return message;
}
