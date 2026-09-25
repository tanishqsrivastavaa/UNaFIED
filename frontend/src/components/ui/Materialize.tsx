import { useMemo } from "react";

const SPREAD_MS = 900;
const SHIMMER_MS = 110;

/*
 * Words keep reading order but the pace quickens, so a long reply still lands
 * in under a second. A fixed pseudo-random offset per word gives the shimmer
 * without Math.random (delays must not change between renders).
 */
function delayFor(wordIndex: number): number {
    const paced = SPREAD_MS * (1 - Math.exp(-wordIndex / 55));
    const shimmer = (((wordIndex * 7919) % 97) / 97) * SHIMMER_MS;
    return Math.round(paced + shimmer);
}

interface Props {
    text: string;
    /** false renders plain text — history should not replay its entrance. */
    animate: boolean;
}

/**
 * Agent text that arrives like ink: each word fades in blush and cools to the
 * surrounding colour. Keys are positional, so text that grows while streaming
 * only animates the new words.
 */
export default function Materialize({ text, animate }: Props) {
    const parts = useMemo(() => {
        let word = 0;
        return text.split(/(\s+)/).map((part) => {
            const isSpace = part === "" || /^\s+$/.test(part);
            return { part, isSpace, delay: isSpace ? 0 : delayFor(word++) };
        });
    }, [text]);

    if (!animate) return <>{text}</>;

    return (
        <>
            {parts.map(({ part, isSpace, delay }, i) =>
                isSpace ? (
                    part
                ) : (
                    <span key={i} className="ink-in" style={{ animationDelay: `${delay}ms` }}>
                        {part}
                    </span>
                ),
            )}
        </>
    );
}
