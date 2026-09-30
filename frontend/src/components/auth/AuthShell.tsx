import { useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Wordmark from "../ui/Wordmark";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Holds on to the outlet it mounted with, so the leaving form can animate out intact. */
function FrozenOutlet() {
    const outlet = useOutlet();
    const [frozen] = useState(outlet);
    return frozen;
}

/** One narrow column in a lot of dark: the wordmark in a corner, the form in the middle. */
export default function AuthShell() {
    const { pathname } = useLocation();

    return (
        <div className="grid min-h-dvh w-full grid-rows-[auto_1fr_auto] px-6 py-6 sm:px-10 sm:py-8">
            <motion.header
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, ease: EASE }}
            >
                <Wordmark />
            </motion.header>

            <motion.main
                className="flex items-center justify-center py-12"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
            >
                <div className="w-full max-w-[360px]">
                    <AnimatePresence mode="wait" initial={false}>
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
                </div>
            </motion.main>

            <motion.p
                className="max-w-[46ch] text-sm text-ink-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.25, ease: EASE }}
            >
                UNaFIED sits in your conversations, remembers what was said, and asks before it does anything it
                can&rsquo;t undo.
            </motion.p>
        </div>
    );
}
