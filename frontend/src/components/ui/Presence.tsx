import { cn } from "../../lib/cn";

interface Props {
    /** rest: steady. listen: slow breath. think: quick breath. */
    mode?: "rest" | "listen" | "think";
    className?: string;
}

/**
 * The assistant's mark: one small point of sage light. It is the logo, the
 * "listening" signal and the "thinking" signal. Nothing else is sage.
 */
export default function Presence({ mode = "rest", className }: Props) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                "inline-block size-1.5 shrink-0 rounded-full bg-sage shadow-[0_0_10px_var(--color-sage-glow)]",
                mode === "listen" && "animate-breathe",
                mode === "think" && "animate-breathe-fast",
                className,
            )}
        />
    );
}
