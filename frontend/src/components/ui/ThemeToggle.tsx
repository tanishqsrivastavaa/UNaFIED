import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "../../lib/theme";
import { cn } from "../../lib/cn";
import { EASE } from "../../lib/motion";

/** One press flips light and dark. The three-way choice, including "match the system", lives in Settings. */
export default function ThemeToggle({ className }: { className?: string }) {
    const { theme } = useTheme();
    const next = theme === "dark" ? "light" : "dark";

    return (
        <button
            type="button"
            onClick={() => setTheme(next)}
            aria-label={`Switch to ${next} theme`}
            title={`Switch to ${next} theme`}
            className={cn("btn btn-quiet btn-icon shrink-0 overflow-hidden text-ink-3", className)}
        >
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                    key={theme}
                    className="grid place-items-center"
                    initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 60, scale: 0.6 }}
                    transition={{ duration: 0.28, ease: EASE }}
                >
                    {theme === "dark" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
                </motion.span>
            </AnimatePresence>
        </button>
    );
}
