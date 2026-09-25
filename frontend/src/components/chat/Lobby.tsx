import { motion } from "framer-motion";
import { useChatStore } from "../../stores/chatStore";
import { modKey } from "../../lib/platform";
import Display from "../ui/Display";
import Kbd from "../ui/Kbd";

const EASE = [0.22, 1, 0.36, 1] as const;

/** What the wide screen shows when no conversation is open. */
export default function Lobby({ onNew, creating }: { onNew: () => void; creating: boolean }) {
    const listState = useChatStore((s) => s.listState);
    const hasAny = useChatStore((s) => s.conversations.length > 0);

    return (
        <motion.section
            aria-label="No conversation open"
            className="absolute inset-0 flex flex-col justify-end pb-[16vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18, ease: EASE } }}
            transition={{ duration: 0.5, ease: EASE }}
        >
            {listState !== "loading" && (
                <div className="mx-auto w-full max-w-[728px] px-6">
                    <Display
                        lines={hasAny ? ["Where were", "we?"] : ["Start", "somewhere."]}
                        cursor
                        className="text-[clamp(64px,8vw,120px)] text-parchment"
                    />
                    <motion.p
                        className="mt-6 max-w-[42ch] text-body text-ink-3"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
                    >
                        {hasAny
                            ? "Open a conversation from the list, or start a new one."
                            : "Start a conversation and ask anything. UNaFIED answers in the thread."}
                    </motion.p>
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.65, ease: EASE }}
                    >
                        <button type="button" className="btn btn-primary mt-8 pl-5 pr-3" onClick={onNew} disabled={creating}>
                            {creating ? "Starting…" : "New conversation"}
                            <Kbd className="border-dusk/15 bg-dusk/5 text-dusk/60 pointer-coarse:hidden">{modKey} K</Kbd>
                        </button>
                    </motion.div>
                </div>
            )}
        </motion.section>
    );
}
