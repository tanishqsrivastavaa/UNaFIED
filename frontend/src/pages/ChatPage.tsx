import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useChatStore } from "../stores/chatStore";
import { plainError } from "../lib/errors";
import { isModK } from "../lib/platform";
import { cn } from "../lib/cn";
import Rail from "../components/chat/Rail";
import Thread from "../components/chat/Thread";
import Lobby from "../components/chat/Lobby";

export default function ChatPage() {
    const { conversationId } = useParams();
    const navigate = useNavigate();
    const create = useChatStore((s) => s.create);
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
        <div className="flex h-dvh w-full gap-3 p-2 sm:p-3">
            <Rail
                onNew={() => void startNew()}
                creating={creating}
                createError={createError}
                className={cn("w-full md:w-[296px] md:shrink-0", conversationId && "max-md:hidden")}
            />
            <main className={cn("relative min-w-0 flex-1", !conversationId && "max-md:hidden")}>
                <AnimatePresence initial={false}>
                    {conversationId ? (
                        <Thread key={conversationId} conversationId={conversationId} />
                    ) : (
                        <Lobby key="lobby" onNew={() => void startNew()} creating={creating} />
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
