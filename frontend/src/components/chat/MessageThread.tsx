import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CircleAlert, Radio } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  getConversationDetail,
  sendMessageStream,
  type Message,
} from "../../lib/api";
import MessageBubble from "./MessageBubble";
import SuggestionCard from "./SuggestionCard";
import ChatInput from "./ChatInput";

const measure = "mx-auto w-full max-w-[720px]";

export default function MessageThread() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationTitle, setConversationTitle] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamSuggestion, setStreamSuggestion] = useState<Message["suggestion"]>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!conversationId) return;
    // Reset the view before loading the selected conversation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([]);
    setConversationTitle(null);
    setStreamText("");
    setStreamSuggestion(null);
    setLoadState("loading");

    getConversationDetail(conversationId)
      .then((data) => {
        setMessages(data.messages || []);
        setConversationTitle(data.title || "New Chat");
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, [conversationId]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, streamText, loadState]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!conversationId || streaming) return;

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
            setMessages((prev) => [
              ...prev,
              {
                id: `ai-${Date.now()}`,
                conversation_id: conversationId,
                role: "assistant" as const,
                content: "",
                suggestion: null,
                created_at: new Date().toISOString(),
              },
            ]);

            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                last.content = "";
              }
              return copy;
            });

            setStreaming(false);
          }
        );

        const fresh = await getConversationDetail(conversationId);
        setMessages(fresh.messages || []);
        setConversationTitle(fresh.title || "New Chat");
        setStreamText("");
        setStreamSuggestion(null);
        setLoadState("ready");
      } catch {
        setStreaming(false);
        setStreamText("");
        // Keep an already visible thread usable when the post-send refresh fails.
        setLoadState((current) => (current === "ready" || messages.length > 0 ? "ready" : "error"));
      }
    },
    [conversationId, messages.length, streaming]
  );

  const idle = !streaming;
  const showLoadingCard = loadState === "loading" && messages.length === 0 && idle;
  const showEmptyCard = loadState === "ready" && messages.length === 0 && idle;
  const showErrorCard = loadState === "error" && messages.length === 0 && idle;

  if (!conversationId) {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-pane-1/80 backdrop-blur-sm">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className={`${measure} flex min-h-full flex-col px-6 py-6`}>
            <div className="flex flex-1 items-center justify-center">
              <div className="glass-1 w-full max-w-sm rounded-lg px-6 py-7">
                <div className="flex flex-col items-center text-center">
                  <span className="flex size-9 items-center justify-center rounded-pill border border-edge-hairline bg-frost-1 text-ink-soft">
                    <Radio className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 text-md font-semibold text-ink-bright">Choose a conversation</h2>
                  <p className="mt-2 max-w-[30ch] text-base leading-6 text-ink-soft">
                    Select a conversation or start something new.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-pane-1/80 backdrop-blur-sm">
      {conversationTitle && (
        <header className="glass-2 shrink-0 border-b border-edge-hairline">
          <div className={`${measure} flex h-14 items-center gap-3 px-6`}>
            <button
              type="button"
              onClick={() => navigate("/chat")}
              aria-label="Back to conversations"
              className="btn btn-quiet -ml-2 size-9 shrink-0 p-0 sm:hidden"
            >
              <ArrowLeft size={17} aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
              <h1
                className="truncate text-lg font-semibold leading-5 text-ink-bright"
                title={conversationTitle}
              >
                {conversationTitle}
              </h1>
              <p className="mt-1 truncate text-meta leading-4 text-ink-quiet">
                Private conversation
              </p>
            </div>
          </div>
        </header>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-linear-to-b from-pane-1/90 to-transparent"
          aria-hidden="true"
        />
        <div
          ref={scrollerRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          aria-busy={loadState === "loading"}
        >
        <div className={`${measure} flex min-h-full flex-col px-6 py-6`}>
          {showLoadingCard ? (
            <div className="flex flex-1 items-center justify-center" role="status">
              <div className="glass-1 w-full max-w-sm rounded-lg px-6 py-7">
                <div className="flex flex-col items-center text-center">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="block size-1.5 rounded-pill bg-ink-quiet"
                        initial={reduce ? { opacity: 0.35 } : { opacity: 0.2 }}
                        animate={
                          reduce
                            ? { opacity: 0.35 }
                            : { opacity: [0.2, 0.9, 0.2] }
                        }
                        transition={
                          reduce
                            ? { duration: 0 }
                            : { duration: 1.2, repeat: Infinity, ease: [0.23, 1, 0.32, 1] as const, delay: i * 0.16 }
                        }
                      />
                    ))}
                  </div>
                  <p className="mt-4 text-md font-semibold text-ink-bright">Opening conversation</p>
                  <p className="mt-1 text-base leading-6 text-ink-quiet">Gathering the thread</p>
                </div>
              </div>
            </div>
          ) : showEmptyCard ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="glass-1 w-full max-w-md rounded-lg px-6 py-8">
                <div className="flex flex-col items-center text-center">
                  <span className="flex size-9 items-center justify-center rounded-pill border border-presence-edge bg-presence-dim text-presence">
                    <Radio className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-micro font-medium uppercase tracking-[0.16em] text-presence">
                    A quiet beginning
                  </p>
                  <h2 className="mt-2 text-md font-semibold text-ink-bright">Nothing here yet</h2>
                  <p className="mt-2 max-w-[42ch] text-base leading-6 text-ink-soft">
                    Start the conversation when you are ready. Keep it simple, keep it moving.
                  </p>
                </div>
              </div>
            </div>
          ) : showErrorCard ? (
            <div className="flex flex-1 items-center justify-center" role="alert">
              <div className="glass-2 w-full max-w-md rounded-lg px-6 py-7">
                <div className="flex flex-col items-center text-center">
                  <span className="flex size-9 items-center justify-center rounded-pill border border-edge-hairline bg-frost-1 text-ink-soft">
                    <CircleAlert className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 text-md font-semibold text-ink-bright">
                    Conversation unavailable
                  </h2>
                  <p className="mt-2 max-w-[38ch] text-base leading-6 text-ink-soft">
                    This thread could not be opened. Your other conversations are still available.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-auto">
              {loadState === "error" && (
                <div className="mb-5 flex items-start gap-3 rounded-lg border border-edge-hairline bg-frost-1 px-4 py-3" role="alert">
                  <CircleAlert
                    className="mt-0.5 size-4 shrink-0 text-ink-soft"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-ink-bright">
                      Conversation unavailable
                    </p>
                    <p className="mt-1 text-base leading-6 text-ink-soft">
                      This thread could not be refreshed. The messages below are what was last
                      loaded.
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg, index) => {
                const previous = messages[index - 1];
                const isGroupStart = !previous || previous.role !== msg.role;

                return (
                  <div
                    key={msg.id}
                    className={`group/start ${index === 0 ? "" : isGroupStart ? "mt-5" : "mt-1"}`}
                    data-group-start={isGroupStart ? "true" : "false"}
                  >
                    <MessageBubble message={msg} />
                    {msg.role === "assistant" && msg.suggestion && (
                      <div className="ml-[52px] mt-2 min-w-0">
                        <SuggestionCard suggestion={msg.suggestion} />
                      </div>
                    )}
                  </div>
                );
              })}

              {streaming && streamText && (
                <div className="mt-5">
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
                    <div className="ml-[52px] mt-2 min-w-0">
                      <SuggestionCard suggestion={streamSuggestion} />
                    </div>
                  )}
                </div>
              )}

              {streaming && !streamText && (
                <div
                  className="mt-5 grid grid-cols-[24px_minmax(0,1fr)] gap-3"
                  role="status"
                  aria-label="UNaFIED is listening"
                >
                  <span className="block size-6" aria-hidden="true" />
                  <div className="presence-mark min-w-0 pl-4">
                    <p className="mb-1 h-4 text-micro font-medium leading-4 tracking-[0.08em] text-presence">
                      UNaFIED
                    </p>
                    <div className="flex min-h-6 items-center gap-1" aria-hidden="true">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="block size-1 rounded-pill bg-presence"
                          initial={reduce ? { opacity: 0.35 } : { opacity: 0.2 }}
                          animate={reduce ? { opacity: 0.35 } : { opacity: [0.2, 1, 0.2] }}
                          transition={
                            reduce
                              ? { duration: 0 }
                              : { duration: 1.1, repeat: Infinity, ease: [0.23, 1, 0.32, 1] as const, delay: i * 0.15 }
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
        </div>
      </div>

      <div className="relative shrink-0 border-t border-edge-hairline bg-pane-1/80 backdrop-blur-md">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-full h-10 bg-linear-to-b from-transparent to-pane-1/80"
          aria-hidden="true"
        />
        <div className={`${measure} px-2`}>
          <ChatInput onSend={handleSend} disabled={streaming} />
        </div>
      </div>
    </section>
  );
}
