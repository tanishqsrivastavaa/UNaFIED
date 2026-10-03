import { useSyncExternalStore } from "react";

/** "system" follows the OS; the other two are a choice this browser remembers. */
export type ThemeChoice = "system" | "light" | "dark";
export type Theme = "light" | "dark";

/* Keep in step with the inline script in index.html, which applies this before first paint. */
const KEY = "unafied:theme";
const BAR: Record<Theme, string> = { light: "#ececef", dark: "#09090b" };
const system = window.matchMedia("(prefers-color-scheme: dark)");

function stored(): ThemeChoice {
    try {
        const value = localStorage.getItem(KEY);
        return value === "light" || value === "dark" ? value : "system";
    } catch {
        return "system";
    }
}

let choice: ThemeChoice = stored();
const listeners = new Set<() => void>();

function resolve(c: ThemeChoice): Theme {
    return c === "system" ? (system.matches ? "dark" : "light") : c;
}

/** Repaints in the resolved theme, crossfading the old page into the new one where the browser can. */
function apply() {
    const next = resolve(choice);
    const root = document.documentElement;
    if (root.dataset.theme !== next) {
        const paint = () => {
            root.dataset.theme = next;
            document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR[next]);
        };
        if (document.startViewTransition && !document.hidden) document.startViewTransition(paint);
        else paint();
    }
    listeners.forEach((listener) => listener());
}

system.addEventListener("change", () => {
    if (choice === "system") apply();
});

export function setTheme(next: ThemeChoice) {
    choice = next;
    try {
        if (next === "system") localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, next);
    } catch {
        // Blocked storage: the choice still holds for this visit.
    }
    apply();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** The person's choice, and the theme it comes to right now. */
export function useTheme(): { choice: ThemeChoice; theme: Theme } {
    const snapshot = useSyncExternalStore(subscribe, () => `${choice}:${resolve(choice)}`);
    const [c, t] = snapshot.split(":") as [ThemeChoice, Theme];
    return { choice: c, theme: t };
}
