"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";

type Message = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; updated_at: string };

const THINKING_PHRASES = [
  "Thinking…",
  "Cooking something up…",
  "Crunching tokens…",
  "Consulting the neurons…",
  "Warming up the CPU…",
  "We're cooking…",
  "Assembling thoughts…",
];

export function Chat({
  userEmail,
  onSignOut,
  modelName,
}: {
  userEmail: string;
  onSignOut: () => void;
  modelName: string;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshConversations();
  }, []);

  useEffect(() => {
    if (!isStreaming) return;
    const id = setInterval(() => {
      setThinkingIndex((i) => (i + 1) % THINKING_PHRASES.length);
    }, 1600);
    return () => clearInterval(id);
  }, [isStreaming]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage unavailable; theme just won't persist across visits
    }
  }

  async function refreshConversations() {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      // best-effort; sidebar just stays as-is
    }
  }

  function startNewChat() {
    if (isStreaming || isLoadingConversation) return;
    setConversationId(null);
    setMessages([]);
  }

  async function openConversation(id: string) {
    if (isStreaming || isLoadingConversation || id === conversationId) return;
    setIsLoadingConversation(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
      setConversationId(id);
    } finally {
      setIsLoadingConversation(false);
    }
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === conversationId) {
      setConversationId(null);
      setMessages([]);
    }
    await fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);
    setThinkingIndex(0);
    setTokenCount(0);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, conversationId }),
      });

      if (!res.ok || !res.body) {
        throw new Error(await res.text());
      }

      const newConversationId = res.headers.get("X-Conversation-Id");
      const isNewConversation = newConversationId && newConversationId !== conversationId;
      if (isNewConversation) {
        setConversationId(newConversationId);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          assistantText += chunk;
          setTokenCount((c) => c + 1);
          setMessages([...nextMessages, { role: "assistant", content: assistantText }]);
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }

      refreshConversations();
    } catch (err) {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: `Error: ${(err as Error).message}` },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <aside className="flex w-64 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="p-3">
          <button
            onClick={startNewChat}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            + New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={`group mb-1 flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ${
                c.id === conversationId
                  ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                  : "text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-200"
              }`}
            >
              <span className="truncate">{c.title}</span>
              <button
                onClick={(e) => deleteConversation(c.id, e)}
                className="ml-2 hidden shrink-0 text-neutral-400 hover:text-neutral-900 group-hover:block dark:text-neutral-500 dark:hover:text-neutral-200"
                aria-label="Delete chat"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
          <div className="mb-2 truncate text-xs text-neutral-500">{userEmail}</div>
          <div className="flex items-center justify-between">
            <form action={onSignOut}>
              <button className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200">
                Sign out
              </button>
            </form>
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              suppressHydrationWarning
              className="rounded-md px-2 py-1 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800"
            >
              {isDark ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h1 className="text-sm font-medium">MyGPT</h1>
          {modelName && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              {modelName}
            </span>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.length === 0 && (
              <p className="mt-20 text-center text-sm text-neutral-500">
                {isLoadingConversation ? "Loading…" : "Ask me anything."}
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`rounded-2xl px-4 py-2 text-[15px] leading-relaxed ${
                    m.role === "user"
                      ? "max-w-[80%] whitespace-pre-wrap bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-50"
                      : "max-w-full min-w-0 bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <>
                      {m.content ? (
                        <Markdown content={m.content} isDark={isDark} />
                      ) : isStreaming && i === messages.length - 1 ? (
                        <span className="inline-flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                          <span className="flex gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                          </span>
                          {THINKING_PHRASES[thinkingIndex]}
                        </span>
                      ) : null}
                      {isStreaming && i === messages.length - 1 && tokenCount > 0 && (
                        <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                          🔥 {tokenCount} tokens burned
                        </div>
                      )}
                    </>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        <form
          onSubmit={sendMessage}
          className="border-t border-neutral-200 px-4 py-4 dark:border-neutral-800"
        >
          <div className="mx-auto flex max-w-3xl gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message MyGPT…"
              className="flex-1 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-500"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
