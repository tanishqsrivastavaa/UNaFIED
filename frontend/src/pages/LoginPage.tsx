import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { plainError } from "../lib/errors";
import { EmailField, FormError, PasswordField } from "../components/auth/fields";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const login = useAuthStore((s) => s.login);
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        try {
            await login(email.trim(), password);
            navigate("/chat", { replace: true });
        } catch (err) {
            setError(plainError(err, "That didn't work. Check your email and password, then try again."));
            setPending(false);
        }
    };

    return (
        <>
            <h2 className="text-xl font-semibold tracking-[-0.015em] text-ink">Sign in</h2>

            <form className="mt-7 flex flex-col gap-5" onSubmit={handleSubmit} aria-busy={pending}>
                <EmailField
                    id="login-email"
                    label="Email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "login-error" : undefined}
                    required
                    autoFocus
                />
                <PasswordField
                    id="login-password"
                    label="Password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "login-error" : undefined}
                    required
                />

                {error && <FormError id="login-error" message={error} />}

                <button type="submit" className="btn btn-primary mt-1 w-full" disabled={pending}>
                    {pending ? (
                        <>
                            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                            Signing in…
                        </>
                    ) : (
                        "Sign in"
                    )}
                </button>
            </form>

            <p className="mt-8 text-sm text-ink-3">
                New here?{" "}
                <Link
                    to="/signup"
                    className="rounded-xs font-medium text-ink underline decoration-line-3 underline-offset-4 transition-colors duration-200 hover:decoration-ink"
                >
                    Create an account
                </Link>
            </p>
        </>
    );
}
