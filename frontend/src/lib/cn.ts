import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * tailwind-merge only knows Tailwind's stock sizes. Without this it reads the
 * custom `text-micro`, `text-meta` and `text-body` (index.css @theme) as colours,
 * and `cn("text-body text-ink")` silently drops the size.
 */
const twMerge = extendTailwindMerge({
    extend: { theme: { text: ["micro", "meta", "body"] } },
});

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
