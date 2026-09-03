import { createClient } from "@/lib/supabase/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

function titleFromMessage(text: string) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New chat";
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const {
    messages,
    conversationId,
  }: { messages: ChatMessage[]; conversationId?: string | null } =
    await request.json();

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

  let activeConversationId = conversationId ?? null;
  if (!activeConversationId) {
    const { rows } = await pool.query<{ id: string }>(
      "insert into conversations (user_id, title) values ($1, $2) returning id",
      [user.id, titleFromMessage(lastUserMessage?.content ?? "")],
    );
    activeConversationId = rows[0].id;
  }

  if (lastUserMessage) {
    await pool.query(
      "insert into messages (conversation_id, role, content) values ($1, 'user', $2)",
      [activeConversationId, lastUserMessage.content],
    );
    await pool.query("update conversations set updated_at = now() where id = $1", [
      activeConversationId,
    ]);
  }

  const ollamaResponse = await fetch(
    `${process.env.OLLAMA_BASE_URL}/api/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL,
        messages,
        stream: true,
      }),
    },
  );

  if (!ollamaResponse.ok || !ollamaResponse.body) {
    const detail = await ollamaResponse.text().catch(() => "");
    return new Response(`Ollama request failed: ${detail}`, { status: 502 });
  }

  const reader = ollamaResponse.body.getReader();
  const decoder = new TextDecoder();
  let assistantText = "";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        if (assistantText) {
          await pool.query(
            "insert into messages (conversation_id, role, content) values ($1, 'assistant', $2)",
            [activeConversationId, assistantText],
          );
          await pool.query(
            "update conversations set updated_at = now() where id = $1",
            [activeConversationId],
          );
        }
        controller.close();
        return;
      }

      const lines = decoder.decode(value, { stream: true }).split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            assistantText += parsed.message.content;
            controller.enqueue(new TextEncoder().encode(parsed.message.content));
          }
        } catch {
          // partial line straddling chunk boundary; Ollama always sends
          // one complete JSON object per line so this should not happen
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": activeConversationId,
    },
  });
}
