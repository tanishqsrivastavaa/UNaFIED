import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { useAuthStore } from "../stores/authStore";

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const signup = useAuthStore((s) => s.signup);
    const error = useAuthStore((s) => s.error);
    const loading = useAuthStore((s) => s.loading);
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (password !== confirm) return;
        try {
            await signup(email, password);
            navigate("/chat");
        } catch {
            return;
        }
    };

    const passwordMismatch = confirm.length > 0 && password !== confirm;
    const confirmDescribedBy = [
        passwordMismatch ? "signup-password-mismatch" : "",
        error ? "signup-error" : "",
    ]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
        <main className="flex min-h-screen items-center justify-center overflow-y-auto px-4 py-8 sm:px-6 sm:py-12">
            <section
                className="glass-2 w-full max-w-[400px] -translate-y-2 rounded-lg border border-edge-hairline p-6 sm:p-8"
                aria-labelledby="signup-title"
            >
                <header className="mb-7">
                    <p className="font-mono text-micro font-medium uppercase tracking-[0.24em] text-ink-soft">UNaFIED</p>
                    <h1 id="signup-title" className="mt-4 text-xl font-semibold leading-6 text-ink-bright">
                        Create an account.
                    </h1>
                    <p className="mt-2 text-sm leading-5 text-ink-soft">
                        A quieter place for the conversations that matter.
                    </p>
                </header>

                <form className="flex flex-col gap-5" onSubmit={handleSubmit} aria-busy={loading}>
                    <div>
                        <label htmlFor="signup-email" className="mb-2 block text-meta font-medium leading-4 text-ink-soft">
                            Email
                        </label>
                        <input
                            id="signup-email"
                            type="email"
                            className="field"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            aria-invalid={Boolean(error)}
                            aria-describedby={error ? "signup-error" : undefined}
                            required
                            autoFocus
                        />
                    </div>

                    <div>
                        <label htmlFor="signup-password" className="mb-2 block text-meta font-medium leading-4 text-ink-soft">
                            Password
                        </label>
                        <input
                            id="signup-password"
                            type="password"
                            className="field"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            aria-invalid={Boolean(error)}
                            aria-describedby={error ? "signup-error" : undefined}
                            required
                            minLength={6}
                        />
                    </div>

                    <div>
                        <label htmlFor="signup-confirm" className="mb-2 block text-meta font-medium leading-4 text-ink-soft">
                            Confirm password
                        </label>
                        <input
                            id="signup-confirm"
                            type="password"
                            className="field"
                            placeholder="••••••••"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            aria-invalid={passwordMismatch || Boolean(error)}
                            aria-describedby={confirmDescribedBy}
                            required
                        />
                        {passwordMismatch && (
                            <p
                                id="signup-password-mismatch"
                                role="alert"
                                aria-live="polite"
                                className="mt-2 border-l-4 border-ink-soft pl-3 text-meta leading-5 text-ink-soft"
                            >
                                Passwords don't match
                            </p>
                        )}
                    </div>

                    {error && (
                        <p
                            id="signup-error"
                            role="alert"
                            aria-live="polite"
                            className="border-l-2 border-ink-quiet pl-3 text-meta leading-5 text-ink"
                        >
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary h-10 w-full"
                        disabled={loading || passwordMismatch}
                    >
                        {loading ? (
                            <>
                                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                                Creating account…
                            </>
                        ) : (
                            "Create Account"
                        )}
                    </button>
                </form>

                <p className="mt-7 border-t border-edge-hairline pt-6 text-center text-meta leading-4 text-ink-soft">
                    Already have an account?{" "}
                    <Link
                        to="/login"
                        className="font-medium text-ink underline decoration-edge-strong underline-offset-4 hover:text-ink-bright"
                    >
                        Sign in
                    </Link>
                </p>
            </section>
        </main>
    );
}
