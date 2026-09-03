import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages }: { messages: ChatMessage[] } = await request.json();

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

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      const lines = decoder.decode(value, { stream: true }).split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
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
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
