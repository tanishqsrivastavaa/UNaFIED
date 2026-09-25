import Cursor from "./Cursor";

export default function Wordmark({ mode = "rest" }: { mode?: "rest" | "listen" }) {
    return (
        <span className="inline-flex items-center gap-2.5 text-sm">
            <Cursor mode={mode} className="h-3.5 w-2" />
            <span className="font-mono text-sm font-medium tracking-[0.06em] text-ink">UNaFIED</span>
        </span>
    );
}
