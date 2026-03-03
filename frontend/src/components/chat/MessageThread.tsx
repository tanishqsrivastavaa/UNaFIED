import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
    getConversationDetail,
    sendMessageStream,
    type Message,
} from "../../lib/api";
import MessageBubble from "./MessageBubble";
import SuggestionCard from "./SuggestionCard";
import ChatInput from "./ChatInput";

export default function MessageThread() {
    const { conversationId } = useParams();
    const [messages, setMessages] = useState<Message[]>([]);
    const [streaming, setStreaming] = useState(false);
    const [streamText, setStreamText] = useState("");
    const [streamSuggestion, setStreamSuggestion] = useState<Message["suggestion"]>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Fetch conversation messages
    useEffect(() => {
        if (!conversationId) return;
        setMessages([]);
        setStreamText("");
        setStreamSuggestion(null);

        getConversationDetail(conversationId)
            .then((data) => setMessages(data.messages || []))
            .catch(() => { });
    }, [conversationId]);

    // Auto-scroll
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamText]);

    const handleSend = useCallback(
        async (content: string) => {
            if (!conversationId || streaming) return;

            // Add user message optimistically
            const userMsg: Message = {
                id: `temp-${Date.now()}`,
                conversation_id: conversationId,
                role: "user",
                content,
                suggestion: null,
                created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, userMsg]);
            setStreaming(true);
            setStreamText("");
            setStreamSuggestion(null);

            try {
                await sendMessageStream(
                    conversationId,
                    content,
                    (text, suggestion) => {
                        setStreamText((prev) => prev + text);
                        if (suggestion) setStreamSuggestion(suggestion);
                    },
                    () => {
                        // Stream done — add the final assistant message
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: `ai-${Date.now()}`,
                                conversation_id: conversationId,
                                role: "assistant" as const,
                                content: "",       // placeholder, will be replaced
                                suggestion: null,
                                created_at: new Date().toISOString(),
                            },
                        ]);

                        // Replace placeholder with actual streamed content
                        setMessages((prev) => {
                            const copy = [...prev];
                            const last = copy[copy.length - 1];
                            if (last && last.role === "assistant") {
                                last.content = ""; // will be set below via closure
                            }
                            return copy;
                        });

                        setStreaming(false);
                    }
                );

                // After streaming, replace the final message with full content
                setMessages((prev) => {
                    const copy = [...prev];
                    const last = copy[copy.length - 1];
                    if (last && last.role === "assistant") {
                        // We need to set the full streamed text — but we're in a closure
                        // so we'll rely on a fresh fetch instead
                    }
                    return copy;
                });

                // Refetch to get the actual saved message with correct ID
                const fresh = await getConversationDetail(conversationId);
                setMessages(fresh.messages || []);
                setStreamText("");
                setStreamSuggestion(null);
            } catch {
                setStreaming(false);
                setStreamText("");
            }
        },
        [conversationId, streaming]
    );

    if (!conversationId) {
        return (
            <div className="thread-empty">
                <h2>UNaFIED</h2>
                <p>Select a conversation or create a new one to get started.</p>

                <style>{`
          .thread-empty {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--color-text-muted);
            gap: 0.5rem;
          }
          .thread-empty h2 {
            font-size: 2rem;
            color: var(--color-text-secondary);
          }
          .thread-empty p {
            font-size: 0.9rem;
          }
        `}</style>
            </div>
        );
    }

    return (
        <div className="thread-wrapper">
            {/* Messages */}
            <div className="thread-messages">
                {messages.map((msg) => (
                    <div key={msg.id}>
                        <MessageBubble message={msg} />
                        {msg.suggestion && (
                            <SuggestionCard suggestion={msg.suggestion} />
                        )}
                    </div>
                ))}

                {/* Streaming bubble */}
                {streaming && streamText && (
                    <div>
                        <MessageBubble
                            message={{
                                id: "streaming",
                                conversation_id: conversationId,
                                role: "assistant",
                                content: streamText,
                                suggestion: null,
                                created_at: new Date().toISOString(),
                            }}
                        />
                        {streamSuggestion && (
                            <SuggestionCard suggestion={streamSuggestion} />
                        )}
                    </div>
                )}

                {/* Typing indicator */}
                {streaming && !streamText && (
                    <div className="typing-indicator">
                        <span /><span /><span />
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <ChatInput onSend={handleSend} disabled={streaming} />

            <style>{`
        .thread-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--color-surface);
        }
        .thread-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem 1.25rem;
        }
        .typing-indicator {
          display: flex;
          gap: 0.3rem;
          padding: 0.5rem 0;
          margin-left: 2.6rem;
        }
        .typing-indicator span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ccc;
          animation: typing 1.4s infinite;
        }
        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }
        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes typing {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>
        </div>
    );
}
