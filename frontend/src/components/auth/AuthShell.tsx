import { useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Display from "../ui/Display";
import Wordmark from "../ui/Wordmark";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Holds on to the outlet it mounted with, so the leaving form can animate out intact. */
function FrozenOutlet() {
    const outlet = useOutlet();
    const [frozen] = useState(outlet);
    return frozen;
}

export default function AuthShell() {
    const { pathname } = useLocation();

    return (
        <div className="relative min-h-dvh w-full overflow-x-hidden">
            <div className="mx-auto grid min-h-dvh w-full max-w-[1360px] grid-rows-[auto_1fr_auto] gap-y-10 px-5 py-6 sm:px-10 sm:py-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:px-14 lg:py-10">
                <motion.header
                    className="lg:col-span-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, ease: EASE }}
                >
                    <Wordmark />
                </motion.header>

                <section className="flex flex-col justify-end self-stretch lg:pb-6">
                    <Display
                        lines={["Say it", "once."]}
                        cursor
                        delay={150}
                        className="text-[clamp(88px,15vw,212px)] text-parchment"
                    />
                    <motion.p
                        className="mt-8 max-w-[38ch] text-lg text-ink-2 sm:mt-10"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.9, delay: 0.75, ease: EASE }}
                    >
                        UNaFIED sits in your conversations, remembers what was said, and asks before it does
                        anything it can&rsquo;t undo.
                    </motion.p>
                </section>

                <motion.section
                    className="glass w-full self-center rounded-[28px] p-7 sm:p-9 lg:col-start-2 lg:row-start-2 lg:mb-6 lg:self-end"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, delay: 0.35, ease: EASE }}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={pathname}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.22, ease: EASE }}
                        >
                            <FrozenOutlet />
                        </motion.div>
                    </AnimatePresence>
                </motion.section>
            </div>
        </div>
    );
}
