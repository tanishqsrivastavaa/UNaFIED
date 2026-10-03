import type { CSSProperties } from "react";
import { cn } from "../../lib/cn";

/**
 * Three dots in a travelling wave: someone is writing. Purely visual; say what
 * is happening in text next to it. Reduced motion holds them still (index.css).
 */
export default function Dots({ className }: { className?: string }) {
    return (
        <span aria-hidden="true" data-dots className={cn("dots", className)}>
            {[0, 1, 2].map((i) => (
                <span key={i} style={{ "--i": i } as CSSProperties} />
            ))}
        </span>
    );
}
