import { cn } from "../../lib/cn";

interface Props {
    /**
     * rest: steady. listen: slow breath. think: quick breath.
     * glow: stays solid while a halo behind it breathes — for large sizes,
     * where fading the pale block itself would turn it grey.
     */
    mode?: "rest" | "listen" | "think" | "glow";
    className?: string;
}

/** The agent's mark: a blush block cursor, borrowed from a terminal prompt. */
export default function Cursor({ mode = "rest", className }: Props) {
    if (mode === "glow") {
        return (
            <span aria-hidden="true" className={cn("relative inline-block shrink-0 align-[-0.12em]", className)}>
                <span className="absolute -inset-[45%] animate-glow rounded-full bg-blush/35 blur-2xl" />
                <span className="relative block size-full rounded-[3px] bg-blush" />
            </span>
        );
    }

    return (
        <span
            aria-hidden="true"
            className={cn(
                "inline-block h-[0.95em] w-[0.52em] shrink-0 rounded-[2px] bg-blush align-[-0.12em] shadow-[0_0_18px_var(--color-blush-glow)]",
                mode === "listen" && "animate-breathe",
                mode === "think" && "animate-breathe-fast",
                className,
            )}
        />
    );
}
