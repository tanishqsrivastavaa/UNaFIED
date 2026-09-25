import { LogOut } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logoutFn = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [loggingOut, setLoggingOut] = useState(false);
  const email = user?.email;
  const initial = email?.charAt(0).toUpperCase() || "?";

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutFn();
      navigate("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="glass-2 z-20 flex h-14 shrink-0 items-center gap-3 border-x-0 border-t-0 px-3 sm:gap-4 sm:px-4">
      <div className="flex items-center gap-2.5">
        <span
          className="glass-3 flex size-7 items-center justify-center rounded-md"
          aria-hidden="true"
        >
          <span className="size-1.5 rounded-pill bg-presence shadow-[0_0_10px_1px_var(--color-presence-glow)]" />
        </span>
        <span className="text-md font-medium tracking-[-0.03em] text-ink-bright">
          unfied
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div
          className="flex items-center gap-2 rounded-pill border border-edge-hairline bg-frost-1 py-1 pl-2.5 pr-3"
          role="status"
        >
          <motion.span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-pill bg-presence"
            animate={reduceMotion ? { opacity: 0.6 } : { opacity: [0.3, 0.85, 0.3] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="text-micro font-medium tracking-[0.04em] text-ink-soft">Available</span>
        </div>

        {email && (
          <>
            <span className="hairline h-5 w-px max-sm:hidden" aria-hidden="true" />
            <span
              className="glass-3 flex size-7 shrink-0 items-center justify-center rounded-md text-micro font-semibold text-ink-bright"
              aria-hidden="true"
            >
              {initial}
            </span>
            <span className="hidden max-w-40 truncate text-sm text-ink-soft sm:inline" title={email}>
              {email}
            </span>
            <button
              type="button"
              aria-label="Log out"
              title="Log out"
              onClick={handleLogout}
              disabled={loggingOut}
              className="btn btn-quiet size-9 shrink-0 p-0 disabled:cursor-not-allowed"
            >
              <LogOut size={15} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
