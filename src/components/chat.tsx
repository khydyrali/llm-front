"use client";

import { useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export function Chat({
  userEmail,
  onSignOut,
}: {
  userEmail: string;
  onSignOut: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        throw new Error(await res.text());
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
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <h1 className="text-sm font-medium">MyGPT</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">{userEmail}</span>
          <form action={onSignOut}>
            <button className="text-xs text-neutral-500 hover:text-neutral-200">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 && (
            <p className="mt-20 text-center text-sm text-neutral-500">
              Ask me anything.
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
  );
}
