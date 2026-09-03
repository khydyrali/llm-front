"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; updated_at: string };

export function Chat({
  userEmail,
  onSignOut,
}: {
  userEmail: string;
  onSignOut: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshConversations();
  }, []);

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
        assistantText += decoder.decode(value, { stream: true });
        setMessages([...nextMessages, { role: "assistant", content: assistantText }]);
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      <aside className="flex w-64 flex-col border-r border-neutral-800 bg-neutral-900">
        <div className="p-3">
          <button
            onClick={startNewChat}
            className="w-full rounded-lg border border-neutral-700 px-3 py-2 text-left text-sm hover:bg-neutral-800"
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
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200"
              }`}
            >
              <span className="truncate">{c.title}</span>
              <button
                onClick={(e) => deleteConversation(c.id, e)}
                className="ml-2 hidden shrink-0 text-neutral-500 hover:text-neutral-200 group-hover:block"
                aria-label="Delete chat"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-neutral-800 p-3">
          <div className="mb-2 truncate text-xs text-neutral-500">{userEmail}</div>
          <form action={onSignOut}>
            <button className="text-xs text-neutral-500 hover:text-neutral-200">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center border-b border-neutral-800 px-4 py-3">
          <h1 className="text-sm font-medium">MyGPT</h1>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
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
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-neutral-100 text-neutral-900"
                      : "bg-neutral-800 text-neutral-100"
                  }`}
                >
                  {m.content || (isStreaming && i === messages.length - 1 ? "…" : "")}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        <form
          onSubmit={sendMessage}
          className="border-t border-neutral-800 px-4 py-4"
        >
          <div className="mx-auto flex max-w-2xl gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message MyGPT…"
              className="flex-1 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm outline-none focus:border-neutral-500"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
