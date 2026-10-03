import { useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Wordmark from "../ui/Wordmark";
import ThemeToggle from "../ui/ThemeToggle";
import { EASE } from "../../lib/motion";

/** Holds on to the outlet it mounted with, so the leaving form can animate out intact. */
function FrozenOutlet() {
    const outlet = useOutlet();
    const [frozen] = useState(outlet);
    return frozen;
}

/** The wordmark and a theme switch on top, one card in the middle, one line about the product below. */
export default function AuthShell() {
    const { pathname } = useLocation();

    return (
        <div className="grid min-h-dvh w-full grid-rows-[auto_1fr_auto] px-4 py-4 sm:px-8 sm:py-6">
            <motion.header
                className="flex h-10 items-center justify-between pl-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, ease: EASE }}
            >
                <Wordmark />
                <ThemeToggle />
            </motion.header>

            <main className="flex items-center justify-center py-10">
                <motion.div
                    className="w-full max-w-[400px] rounded-2xl bg-panel px-6 py-8 shadow-panel sm:px-9 sm:py-10"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.06, ease: EASE }}
                >
                    {/* No initial={false}: it would silence every entrance inside the first form, for good. */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={pathname}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.2, ease: EASE }}
                        >
                            <FrozenOutlet />
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            </main>

            <motion.p
                className="mx-auto max-w-[46ch] pb-2 text-center text-sm text-ink-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.12, ease: EASE }}
            >
                UNaFIED sits in your conversations, remembers what was said, and asks before it does anything it
                can&rsquo;t undo.
            </motion.p>
        </div>
    );
}
