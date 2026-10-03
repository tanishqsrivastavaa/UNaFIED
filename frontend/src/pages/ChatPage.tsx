import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useChatStore } from "../stores/chatStore";
import { plainError } from "../lib/errors";
import { isModK } from "../lib/platform";
import { cn } from "../lib/cn";
import { EASE } from "../lib/motion";
import Rail from "../components/chat/Rail";
import Thread from "../components/chat/Thread";
import Lobby from "../components/chat/Lobby";
import Alerts from "../components/chat/Alerts";
import { pushSupported, syncSubscription } from "../lib/push";

export default function ChatPage() {
    const { conversationId } = useParams();
    const navigate = useNavigate();
    const create = useChatStore((s) => s.create);
    const startAppSocket = useChatStore((s) => s.startAppSocket);
    const stopAppSocket = useChatStore((s) => s.stopAppSocket);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const startNew = useCallback(async () => {
        if (creating) return;
        setCreating(true);
        setCreateError(null);
        try {
            const convo = await create();
            navigate(`/chat/${convo.id}`);
        } catch (err) {
            setCreateError(plainError(err, "A new conversation couldn't be started. Try again."));
        } finally {
            setCreating(false);
        }
    }, [create, creating, navigate]);

    // A shared browser's closed-app alerts follow whoever is signed in now
    useEffect(() => {
        if (pushSupported) void syncSubscription().catch(() => undefined);
    }, []);

    // News from outside the open thread: activity elsewhere, new chats, reminders
    useEffect(() => {
        startAppSocket();
        return stopAppSocket;
    }, [startAppSocket, stopAppSocket]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!isModK(e)) return;
            e.preventDefault();
            void startNew();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [startNew]);

    return (
        <div className="flex h-dvh w-full md:gap-2 md:p-2">
            <Rail
                onNew={() => void startNew()}
                creating={creating}
                createError={createError}
                className={cn("rail-in w-full md:w-[272px] md:shrink-0", conversationId && "max-md:hidden")}
            />
            {/* The conversation is the one raised surface: a panel on the canvas. */}
            <motion.main
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05, ease: EASE }}
                className={cn(
                    "relative min-w-0 flex-1 overflow-hidden bg-panel md:rounded-[20px] md:shadow-panel",
                    !conversationId && "max-md:hidden",
                )}
            >
                {/*
                  * No initial={false} here: Framer hands "initial: false" to everything inside a child
                  * present on the first render, for good, so a thread opened by URL would never animate
                  * a new message.
                  */}
                <AnimatePresence>
                    {conversationId ? (
                        <Thread key={conversationId} conversationId={conversationId} />
                    ) : (
                        <Lobby key="lobby" onNew={() => void startNew()} creating={creating} />
                    )}
                </AnimatePresence>
            </motion.main>
            <Alerts />
        </div>
    );
}
