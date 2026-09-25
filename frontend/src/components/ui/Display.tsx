import { useMemo } from "react";
import { cn } from "../../lib/cn";
import Cursor from "./Cursor";

interface Props {
    lines: string[];
    as?: "h1" | "h2" | "p";
    className?: string;
    /** Adds the agent's breathing cursor after the last letter. */
    cursor?: boolean;
    /** Delay before the first letter, in ms. */
    delay?: number;
}

/**
 * The one loud typographic moment. Letters surface in a loose, uneven order —
 * the way the Buena terminal fills in — then settle.
 */
export default function Display({ lines, as: Tag = "h1", className, cursor, delay = 0 }: Props) {
    const text = lines.join(" ");
    const rows = useMemo(() => {
        let n = 0;
        return lines.map((line) =>
            Array.from(line).map((ch) => {
                const i = n++;
                return { ch, delay: delay + ((i * 7349) % 53) * 11 };
            }),
        );
    }, [lines, delay]);
    const settle = delay + 53 * 11 + 300;

    return (
        <Tag className={cn("display", className)}>
            <span className="sr-only">{text}</span>
            <span aria-hidden="true">
                {rows.map((row, r) => (
                    <span key={r} className="block">
                        {row.map(({ ch, delay: d }, i) =>
                            ch === " " ? (
                                " "
                            ) : (
                                <span key={i} className="ink-in-slow" style={{ animationDelay: `${d}ms` }}>
                                    {ch}
                                </span>
                            ),
                        )}
                        {cursor && r === rows.length - 1 && (
                            <span className="ink-in-slow" style={{ animationDelay: `${settle}ms` }}>
                                <Cursor mode="glow" className="ml-[0.1em] h-[0.66em] w-[0.26em] align-[0.02em]" />
                            </span>
                        )}
                    </span>
                ))}
            </span>
        </Tag>
    );
}
