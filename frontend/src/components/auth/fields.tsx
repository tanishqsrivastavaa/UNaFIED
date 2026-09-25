import { useState, type InputHTMLAttributes } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type">;

export function EmailField({ id, label, hint, ...rest }: InputProps & { id: string; label: string; hint?: string }) {
    const hintId = hint ? `${id}-hint` : undefined;
    return (
        <div>
            <label htmlFor={id} className="mb-2 block text-sm font-medium text-ink-2">
                {label}
            </label>
            <input id={id} type="email" className="field" aria-describedby={hintId} {...rest} />
            {hint && (
                <p id={hintId} className="mt-2 text-meta text-ink-4">
                    {hint}
                </p>
            )}
        </div>
    );
}

export function PasswordField({
    id,
    label,
    hint,
    "aria-describedby": describedBy,
    ...rest
}: InputProps & { id: string; label: string; hint?: string }) {
    const [visible, setVisible] = useState(false);
    const hintId = hint ? `${id}-hint` : undefined;
    const describedByIds = [hintId, describedBy].filter(Boolean).join(" ") || undefined;

    return (
        <div>
            <label htmlFor={id} className="mb-2 block text-sm font-medium text-ink-2">
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    type={visible ? "text" : "password"}
                    className="field pr-12"
                    aria-describedby={describedByIds}
                    {...rest}
                />
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                    className="btn btn-quiet btn-icon absolute right-[3px] top-[3px] rounded-[10px]"
                >
                    {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
            </div>
            {hint && (
                <p id={hintId} className="mt-2 text-meta text-ink-4">
                    {hint}
                </p>
            )}
        </div>
    );
}

export function FormError({ id, message }: { id: string; message: string }) {
    return (
        <p
            id={id}
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-line-2 bg-veil-1 px-3.5 py-3 text-sm text-ink-2"
        >
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
            <span>{message}</span>
        </p>
    );
}
