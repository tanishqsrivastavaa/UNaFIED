import { Fragment, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, LoaderCircle, RotateCcw } from "lucide-react";
import { executeTool, type Message } from "../../lib/api";

const EASE = [0.22, 1, 0.36, 1] as const;

type Suggestion = NonNullable<Message["suggestion"]>;
type RunState = "idle" | "running" | "done" | "failed";

function show(value: unknown): string {
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/**
 * An action the agent wants to take but won't without a yes. Shaped like a
 * ticket: above the tear line is what it will do, the stub is where you decide.
 */
export default function Ticket({ suggestion }: { suggestion: Suggestion }) {
    const [state, setState] = useState<RunState>("idle");
    const [dismissed, setDismissed] = useState(false);
    const [result, setResult] = useState("");
    const params = Object.entries(suggestion.parameters ?? {});
    const running = state === "running";

    const approve = async () => {
        setState("running");
        try {
            const res = await executeTool(suggestion.tool_name, suggestion.parameters);
            setResult(res.result);
            setState("done");
        } catch {
            setState("failed");
        }
    };

    const status =
        state === "running"
            ? `Running ${suggestion.label}.`
            : state === "done"
              ? `${suggestion.label} is done.`
              : state === "failed"
                ? `${suggestion.label} didn't run.`
                : "";

    return (
        <AnimatePresence initial={false}>
            {!dismissed && (
                <motion.section
                    aria-label={`Proposed action: ${suggestion.label}`}
                    aria-busy={running}
                    className="mt-4 w-full max-w-[460px]"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4, transition: { duration: 0.25, ease: EASE } }}
                    transition={{ duration: 0.6, ease: EASE }}
                >
                    <p className="sr-only" role="status" aria-live="polite">
                        {status}
                    </p>

                    <div className="ticket-top rounded-t-[18px] border border-b-0 border-blush-line bg-blush-wash px-5 pb-5 pt-4 backdrop-blur-xl">
                        <p className="eyebrow text-blush">{state === "done" ? "Approved" : "Needs your approval"}</p>
                        <p className="mt-2 text-lg font-semibold tracking-[-0.01em] text-ink">{suggestion.label}</p>
                        {params.length > 0 && (
                            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 font-mono text-meta">
                                {params.map(([key, value]) => (
                                    <Fragment key={key}>
                                        <dt className="text-ink-4">{key}</dt>
                                        <dd className="truncate text-ink-2" title={show(value)}>
                                            {show(value)}
                                        </dd>
                                    </Fragment>
                                ))}
                            </dl>
                        )}
                    </div>

                    <div className="ticket-stub relative rounded-b-[18px] border border-t-0 border-blush-line bg-blush-wash px-5 py-3 backdrop-blur-xl">
                        <span aria-hidden="true" className="absolute inset-x-4 top-0 border-t border-dashed border-blush-line" />

                        {state === "done" ? (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                transition={{ duration: 0.45, ease: EASE }}
                                className="py-1"
                            >
                                <p className="flex items-center gap-2 text-sm font-medium text-blush">
                                    <Check size={15} aria-hidden="true" />
                                    Done
                                </p>
                                {result && (
                                    <pre
                                        tabIndex={0}
                                        aria-label="Result"
                                        className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-sm font-mono text-meta leading-5 text-ink-3"
                                    >
                                        {result}
                                    </pre>
                                )}
                            </motion.div>
                        ) : (
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                                <p className="min-w-0 truncate font-mono text-micro text-ink-4">
                                    {state === "failed" ? "That didn't go through." : suggestion.tool_name}
                                </p>
                                <div className="ml-auto flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        className="btn btn-quiet h-10 px-3.5 text-sm font-medium"
                                        onClick={() => setDismissed(true)}
                                        disabled={running}
                                    >
                                        Not now
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-primary h-10 px-4 text-sm"
                                        onClick={approve}
                                        disabled={running}
                                    >
                                        {running ? (
                                            <>
                                                <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                                                Running…
                                            </>
                                        ) : state === "failed" ? (
                                            <>
                                                <RotateCcw size={14} aria-hidden="true" />
                                                Try again
                                            </>
                                        ) : (
                                            "Approve"
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.section>
            )}
        </AnimatePresence>
    );
}
