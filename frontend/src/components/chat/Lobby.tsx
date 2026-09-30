import { motion } from "framer-motion";
import { useChatStore } from "../../stores/chatStore";
import { modKey } from "../../lib/platform";
import Kbd from "../ui/Kbd";
import Presence from "../ui/Presence";

const EASE = [0.22, 1, 0.36, 1] as const;

/** What the wide screen shows when no conversation is open: one line, one action, a lot of dark. */
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
            transition={{ duration: 0.4, ease: EASE }}
        >
            {listState !== "loading" && (
                <div className="flex max-w-[40ch] flex-col items-center text-center">
                    <Presence mode="listen" className="size-2.5 shadow-[0_0_28px_6px_rgb(179_192_165/0.22)]" />
                    <h1 className="mt-7 text-lg font-medium tracking-[-0.015em] text-ink">
                        {hasAny ? "Where were we?" : "Start somewhere."}
                    </h1>
                    <p className="mt-2 text-base text-ink-3">
                        {hasAny
                            ? "Open a conversation from the list, or start a new one."
                            : "Start a conversation and ask anything. UNaFIED answers in the thread."}
                    </p>
                    <button type="button" className="btn btn-ghost mt-8 h-10 pl-4 pr-2.5" onClick={onNew} disabled={creating}>
                        {creating ? "Starting…" : "New conversation"}
                        <Kbd className="pointer-coarse:hidden">{modKey} K</Kbd>
                    </button>
                </div>
            )}
        </motion.section>
    );
}
