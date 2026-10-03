import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useChatStore } from "../../stores/chatStore";
import { modKey } from "../../lib/platform";
import { EASE } from "../../lib/motion";
import Kbd from "../ui/Kbd";
import Presence from "../ui/Presence";

/** Each line of the empty state arrives a beat after the one above it. */
const line = (i: number) => ({
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.28, delay: 0.08 + i * 0.06, ease: EASE },
});

/** What the wide screen shows when no conversation is open: one line, one action, a lot of quiet. */
export default function Lobby({ onNew, creating }: { onNew: () => void; creating: boolean }) {
    const listState = useChatStore((s) => s.listState);
    const hasAny = useChatStore((s) => s.conversations.length > 0);

    return (
        <motion.section
            aria-label="No conversation open"
            className="absolute inset-0 flex items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE } }}
            transition={{ duration: 0.3, ease: EASE }}
        >
            {listState !== "loading" && (
                <div className="flex max-w-[40ch] flex-col items-center text-center">
                    <motion.span
                        className="grid size-12 place-items-center rounded-full bg-accent-wash ring-1 ring-accent-line"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.35, ease: EASE }}
                    >
                        <Presence mode="listen" className="size-2.5" />
                    </motion.span>
                    <motion.h1 className="mt-6 text-lg font-medium tracking-[-0.015em] text-ink" {...line(0)}>
                        {hasAny ? "Where were we?" : "Start somewhere."}
                    </motion.h1>
                    <motion.p className="mt-2 text-base text-ink-3" {...line(1)}>
                        {hasAny
                            ? "Open a conversation from the list, or start a new one."
                            : "Start a conversation and ask anything. UNaFIED answers in the thread."}
                    </motion.p>
                    <motion.div {...line(2)}>
                        <button type="button" className="btn btn-primary mt-8 h-10 rounded-full pl-4 pr-2.5" onClick={onNew} disabled={creating}>
                            <Plus size={16} aria-hidden="true" />
                            {creating ? "Starting…" : "New conversation"}
                            <Kbd className="bg-[color-mix(in_srgb,var(--panel)_16%,transparent)] text-panel pointer-coarse:hidden">{modKey} K</Kbd>
                        </button>
                    </motion.div>
                </div>
            )}
        </motion.section>
    );
}
