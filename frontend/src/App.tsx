import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "./stores/authStore";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ChatPage from "./pages/ChatPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const user = useAuthStore((s) => s.user);
    const loading = useAuthStore((s) => s.loading);

    if (loading) {
        return (
            <div className="flex min-h-dvh w-full items-center justify-center bg-void p-4" role="status" aria-live="polite">
                <div className="glass-2 flex items-center gap-3 rounded-lg px-4 py-3">
                    <span className="size-2 rounded-pill bg-ink-soft" aria-hidden="true" />
                    <p className="text-sm font-medium text-ink-soft">Restoring your session…</p>
                </div>
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
    const user = useAuthStore((s) => s.user);
    const loading = useAuthStore((s) => s.loading);

    if (loading) return null;
    if (user) return <Navigate to="/chat" replace />;
    return <>{children}</>;
}

export default function App() {
    const hydrate = useAuthStore((s) => s.hydrate);

    useEffect(() => {
        hydrate();
    }, [hydrate]);

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
                <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                <Route path="/chat/:conversationId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/chat" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
