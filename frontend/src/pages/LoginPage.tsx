import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const login = useAuthStore((s) => s.login);
    const error = useAuthStore((s) => s.error);
    const loading = useAuthStore((s) => s.loading);
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            await login(email, password);
            navigate("/chat");
        } catch {
            // error is set in store
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h1>Welcome back.</h1>
                <p className="auth-subtitle">Sign in to continue to UNaFIED</p>

                <form onSubmit={handleSubmit}>
                    <div className="auth-field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="input-field"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="auth-field">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className="input-field"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <p className="auth-error">{error}</p>}

                    <button type="submit" className="btn-accent auth-submit" disabled={loading}>
                        {loading ? "Signing in…" : "Sign In"}
                    </button>
                </form>

                <p className="auth-footer">
                    Don't have an account? <Link to="/signup">Sign up</Link>
                </p>
            </div>

            <style>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          padding: 1rem;
        }
        .auth-card {
          width: 100%;
          max-width: 400px;
        }
        .auth-card h1 {
          font-size: 2rem;
          margin-bottom: 0.25rem;
        }
        .auth-subtitle {
          color: var(--color-text-secondary);
          margin-bottom: 2rem;
          font-size: 0.9rem;
        }
        .auth-field {
          margin-bottom: 1rem;
        }
        .auth-field label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 0.35rem;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .auth-error {
          color: #d44;
          font-size: 0.85rem;
          margin-bottom: 1rem;
        }
        .auth-submit {
          width: 100%;
          padding: 0.85rem;
          font-size: 1rem;
          margin-top: 0.5rem;
        }
        .auth-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .auth-footer {
          text-align: center;
          margin-top: 1.5rem;
          font-size: 0.85rem;
          color: var(--color-text-secondary);
        }
        .auth-footer a {
          color: var(--color-accent-hover);
          text-decoration: none;
          font-weight: 600;
        }
        .auth-footer a:hover {
          text-decoration: underline;
        }
      `}</style>
        </div>
    );
}
