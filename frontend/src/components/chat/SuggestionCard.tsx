import { useState } from "react";
import { AlertCircle, Check, LoaderCircle, X, Zap } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { executeTool } from "../../lib/api";

interface Props {
    suggestion: {
        label: string;
        tool_name: string;
        parameters: Record<string, unknown>;
    };
    onResult?: (result: string) => void;
}

export default function SuggestionCard({ suggestion, onResult }: Props) {
    const [loading, setLoading] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const prefersReducedMotion = useReducedMotion();

    if (dismissed) return null;

    const statusMessage = loading
        ? "Running tool."
        : result !== null
          ? "Completed."
          : error
            ? `Unable to complete. ${error}`
            : "";

    const handleApprove = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await executeTool(suggestion.tool_name, suggestion.parameters);
            setResult(res.result);
            try {
                onResult?.(res.result);
            } catch {
                return;
            }
        } catch {
            setError("Failed to execute tool");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {statusMessage}
            </div>
            <motion.div
                aria-busy={loading}
                className="glass-2 presence-mark mt-2 mb-2 w-full max-w-[720px] rounded-lg border-presence-edge bg-presence-dim p-4"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                    prefersReducedMotion
                        ? { duration: 0.12 }
                        : { duration: 0.18, ease: [0.23, 1, 0.32, 1] as const }
                }
            >
                <div className="flex items-center gap-2 text-micro font-medium uppercase tracking-[0.08em] text-presence">
                    <Zap size={12} aria-hidden="true" />
                    <span>Agent proposal</span>
                </div>

                <p className="mt-2 text-lg font-semibold leading-6 text-ink-bright">
                    {suggestion.label}
                </p>

                <div className="mt-3 flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-micro font-medium uppercase tracking-[0.08em] text-ink-quiet">
                        Tool
                    </span>
                    <code className="tnum min-w-0 truncate">{suggestion.tool_name}</code>
                </div>

                {result !== null ? (
                    <div className="mt-4 rounded-md border border-edge-hairline bg-void p-3">
                        <div className="flex items-center gap-2 text-micro font-medium uppercase tracking-[0.08em] text-presence">
                            <Check size={12} aria-hidden="true" />
                            <span>Completed</span>
                        </div>
                        <pre
                            role="region"
                            aria-label="Tool result"
                            className="mt-2 max-h-40 overflow-auto font-mono text-micro leading-4 whitespace-pre-wrap break-words text-ink-soft"
                        >
                            {result}
                        </pre>
                    </div>
                ) : error ? (
                    <div className="mt-4 rounded-r-md border-y border-l-2 border-r border-edge-strong bg-void p-3">
                        <div className="flex items-center gap-2 text-micro font-medium uppercase tracking-[0.08em] text-ink">
                            <AlertCircle size={12} aria-hidden="true" />
                            <span>Unable to complete</span>
                        </div>
                        <p className="mt-2 text-meta leading-4 text-ink-soft">{error}</p>
                    </div>
                ) : (
                    <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            aria-label="Dismiss suggestion"
                            className="btn btn-quiet w-10 p-0"
                            onClick={() => setDismissed(true)}
                            disabled={loading}
                        >
                            <X size={16} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary px-4"
                            onClick={handleApprove}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <LoaderCircle size={14} className="animate-spin opacity-60" aria-hidden="true" />
                                    <span>Running…</span>
                                </>
                            ) : (
                                "Approve"
                            )}
                        </button>
                    </div>
                )}
            </motion.div>
        </>
    );
}
