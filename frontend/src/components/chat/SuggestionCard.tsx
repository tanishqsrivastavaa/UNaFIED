import { useState } from "react";
import { Zap, X } from "lucide-react";
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

    if (dismissed) return null;

    const handleApprove = async () => {
        setLoading(true);
        try {
            const res = await executeTool(suggestion.tool_name, suggestion.parameters);
            setResult(res.result);
            onResult?.(res.result);
        } catch {
            setResult("Failed to execute tool");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="suggestion-card">
            <div className="suggestion-header">
                <Zap size={14} />
                <span className="suggestion-label">{suggestion.label}</span>
                <button className="suggestion-dismiss" onClick={() => setDismissed(true)}>
                    <X size={14} />
                </button>
            </div>

            <p className="suggestion-tool">
                Tool: <code>{suggestion.tool_name}</code>
            </p>

            {result ? (
                <div className="suggestion-result">
                    <p>{result}</p>
                </div>
            ) : (
                <button
                    className="btn-accent suggestion-approve"
                    onClick={handleApprove}
                    disabled={loading}
                >
                    {loading ? "Running…" : "Approve"}
                </button>
            )}

            <style>{`
        .suggestion-card {
          background: #fff;
          border: 1px solid var(--color-border);
          border-left: 3px solid var(--color-accent);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
          max-width: 400px;
        }
        .suggestion-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-bottom: 0.4rem;
          color: var(--color-text-primary);
        }
        .suggestion-label {
          font-weight: 600;
          font-size: 0.85rem;
          flex: 1;
        }
        .suggestion-dismiss {
          background: none;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          padding: 0.15rem;
          border-radius: 4px;
          display: flex;
        }
        .suggestion-dismiss:hover {
          color: var(--color-text-primary);
        }
        .suggestion-tool {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          margin-bottom: 0.6rem;
        }
        .suggestion-tool code {
          background: #f5f5f5;
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
          font-size: 0.75rem;
        }
        .suggestion-approve {
          font-size: 0.8rem;
          padding: 0.4rem 1rem;
        }
        .suggestion-result {
          background: #f8f8f8;
          border-radius: 6px;
          padding: 0.6rem 0.75rem;
          font-size: 0.8rem;
          color: var(--color-text-primary);
          line-height: 1.4;
        }
      `}</style>
        </div>
    );
}
