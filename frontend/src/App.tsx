import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { useAuthStore } from "./stores/authStore";
import Backdrop from "./components/ui/Backdrop";
import Cursor from "./components/ui/Cursor";
import AuthShell from "./components/auth/AuthShell";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ChatPage from "./pages/ChatPage";

function RequireAuth() {
    const user = useAuthStore((s) => s.user);
    return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function PublicOnly() {
    const user = useAuthStore((s) => s.user);
    return user ? <Navigate to="/chat" replace /> : <Outlet />;
}

/** Shown only while a saved session is being checked; fades in late so fast checks never flash. */
function Splash() {
    return (
        <div className="grid min-h-dvh place-items-center" role="status">
            <span className="sr-only">Restoring your session</span>
            <span style={{ animation: "rise-in 600ms var(--ease-out) 400ms both" }}>
                <Cursor mode="think" className="h-6 w-3.5" />
            </span>
        </div>
    );
}

export default function App() {
    const hydrate = useAuthStore((s) => s.hydrate);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        void hydrate().finally(() => setReady(true));
    }, [hydrate]);

    return (
        <MotionConfig reducedMotion="user">
            <Backdrop />
            {ready ? (
                <BrowserRouter>
                    <Routes>
                        <Route element={<PublicOnly />}>
                            <Route element={<AuthShell />}>
                                <Route path="/login" element={<LoginPage />} />
                                <Route path="/signup" element={<SignupPage />} />
                            </Route>
                        </Route>
                        <Route element={<RequireAuth />}>
                            <Route path="/chat/:conversationId?" element={<ChatPage />} />
                        </Route>
                        <Route path="*" element={<Navigate to="/chat" replace />} />
                    </Routes>
                </BrowserRouter>
            ) : (
                <Splash />
            )}
        </MotionConfig>
    );
}
