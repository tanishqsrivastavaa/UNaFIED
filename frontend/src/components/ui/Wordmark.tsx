import Presence from "./Presence";

export default function Wordmark() {
    return (
        <span className="inline-flex items-center gap-2.5">
            <Presence className="size-2" />
            <span className="text-body font-semibold tracking-[-0.02em] text-ink">UNaFIED</span>
        </span>
    );
}
