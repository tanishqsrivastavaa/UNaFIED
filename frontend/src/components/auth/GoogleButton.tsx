import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LoaderCircle } from "lucide-react";
import { getGoogleClientId } from "../../lib/api";
import { plainError } from "../../lib/errors";
import { useAuthStore } from "../../stores/authStore";
import { FormError } from "./fields";
import { EASE } from "../../lib/motion";

interface CodeClient {
    requestCode(): void;
}

declare global {
    interface Window {
        google?: {
            accounts: {
                oauth2: {
                    initCodeClient(config: {
                        client_id: string;
                        scope: string;
                        ux_mode: "popup";
                        callback: (response: { code?: string; error?: string }) => void;
                        error_callback?: (error: { type: string }) => void;
                    }): CodeClient;
                };
            };
        };
    }
}

let script: Promise<void> | null = null;

/** Google's sign-in library, fetched once, and only when the server has Google sign-in on. */
function loadGoogle() {
    script ??= new Promise((resolve, reject) => {
        const el = document.createElement("script");
        el.src = "https://accounts.google.com/gsi/client";
        el.onload = () => resolve();
        el.onerror = () => {
            script = null;
            el.remove();
            reject(new Error("Google sign-in didn't load"));
        };
        document.head.append(el);
    });
    return script;
}

/** Google's "G", in the colours its brand rules require. */
function GoogleMark() {
    return (
        <svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
    );
}

/** "Continue with Google" under an "or" rule. Shows nothing when the server has Google sign-in off. */
export default function GoogleButton() {
    const client = useRef<CodeClient | null>(null);
    const [ready, setReady] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { client_id } = await getGoogleClientId();
            if (!client_id) return;
            await loadGoogle();
            if (cancelled || !window.google) return;
            client.current = window.google.accounts.oauth2.initCodeClient({
                client_id,
                scope: "openid email",
                ux_mode: "popup",
                callback: async ({ code }) => {
                    if (!code) return; // they declined on Google's screen
                    setPending(true);
                    try {
                        await loginWithGoogle(code);
                        navigate("/chat", { replace: true });
                    } catch (err) {
                        setError(plainError(err, "Google sign-in didn't work. Try again in a moment."));
                        setPending(false);
                    }
                },
                // Closing the popup needs no message; a blocked one does.
                error_callback: ({ type }) => {
                    if (type === "popup_failed_to_open") {
                        setError("Your browser blocked Google's sign-in window. Allow pop-ups for this site, then try again.");
                    }
                },
            });
            setReady(true);
        })().catch(() => { }); // no button; email and password still work
        return () => {
            cancelled = true;
        };
    }, [loginWithGoogle, navigate]);

    if (!ready) return null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: EASE }}>
            <div className="my-6 flex items-center gap-3 text-meta text-ink-4">
                <span className="h-px flex-1 bg-line-2" />
                or
                <span className="h-px flex-1 bg-line-2" />
            </div>
            <button
                type="button"
                className="btn w-full border border-line-2 bg-panel text-ink hover:bg-fill-1"
                disabled={pending}
                onClick={() => {
                    setError(null);
                    client.current?.requestCode(); // must run inside the click, or the popup is blocked
                }}
            >
                {pending ? (
                    <>
                        <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                        Signing in…
                    </>
                ) : (
                    <>
                        <GoogleMark />
                        Continue with Google
                    </>
                )}
            </button>
            {error && (
                <div className="mt-4">
                    <FormError id="google-error" message={error} />
                </div>
            )}
        </motion.div>
    );
}
