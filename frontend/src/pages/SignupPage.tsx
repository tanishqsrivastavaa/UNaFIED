import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { plainError } from "../lib/errors";
import { EmailField, FormError, PasswordField } from "../components/auth/fields";

const MIN_PASSWORD = 6;

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const signup = useAuthStore((s) => s.signup);
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        try {
            await signup(email.trim(), password);
            navigate("/chat", { replace: true });
        } catch (err) {
            setError(plainError(err, "Your account wasn't created. Try again in a moment."));
            setPending(false);
        }
    };

    return (
        <>
            <h2 className="text-xl font-semibold tracking-[-0.015em] text-ink">Create your account</h2>

            <form className="mt-7 flex flex-col gap-5" onSubmit={handleSubmit} aria-busy={pending}>
                <EmailField
                    id="signup-email"
                    label="Email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "signup-error" : undefined}
                    required
                    autoFocus
                />
                <PasswordField
                    id="signup-password"
                    label="Password"
                    hint={`At least ${MIN_PASSWORD} characters.`}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "signup-error" : undefined}
                    minLength={MIN_PASSWORD}
                    required
                />

                {error && <FormError id="signup-error" message={error} />}

                <button type="submit" className="btn btn-primary mt-1 w-full" disabled={pending}>
                    {pending ? (
                        <>
                            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                            Creating account…
                        </>
                    ) : (
                        "Create account"
                    )}
                </button>
            </form>

            <p className="mt-8 text-sm text-ink-3">
                Already have an account?{" "}
                <Link
                    to="/login"
                    className="rounded-xs font-medium text-ink underline decoration-line-3 underline-offset-4 transition-colors duration-200 hover:decoration-ink"
                >
                    Sign in
                </Link>
            </p>
        </>
    );
}
