export const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const modKey = isMac ? "⌘" : "Ctrl";

/** True for ⌘K on macOS and Ctrl+K elsewhere. */
export function isModK(e: KeyboardEvent): boolean {
    return e.key.toLowerCase() === "k" && (isMac ? e.metaKey : e.ctrlKey) && !e.altKey && !e.shiftKey;
}
