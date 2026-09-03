import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";

const MAX_CONCURRENT = Number(process.env.GRADING_MAX_CONCURRENT ?? 2);
let activeRequests = 0;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    marksAwarded: { type: "number" },
    maxMarks: { type: "number" },
    feedback: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
  },
  required: ["marksAwarded", "maxMarks", "feedback", "strengths", "improvements"],
};

function isAuthorized(request: Request) {
  const expected = process.env.GRADING_API_KEY;
  if (!expected) return false;

  const [scheme, token] = (request.headers.get("authorization") ?? "").split(" ");
  if (scheme !== "Bearer" || !token) return false;

  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const question: string | undefined = body?.question;
  const markScheme: string | undefined = body?.markScheme;
  const studentAnswer: string | undefined = body?.studentAnswer;
  const maxMarks: number | undefined = body?.maxMarks;

  if (!markScheme || !studentAnswer) {
    return NextResponse.json(
      { error: "markScheme and studentAnswer are required" },
      { status: 400 },
    );
  }

  if (activeRequests >= MAX_CONCURRENT) {
    return NextResponse.json(
      { error: "Grader is at capacity, please retry shortly" },
      { status: 503 },
    );
  }

  activeRequests++;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const prompt = `You are a strict but fair examiner. Grade the student's answer against the mark scheme below, awarding marks only for what the mark scheme credits.

${question ? `Question:\n${question}\n\n` : ""}Mark scheme:
${markScheme}
${maxMarks ? `\nMaximum marks available: ${maxMarks}\n` : ""}
Student's answer:
${studentAnswer}

Return the marks awarded, brief overall feedback, and short lists of what the student did well and what they missed or got wrong.`;

    const ollamaResponse = await fetch(`${process.env.OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        format: RESPONSE_SCHEMA,
      }),
      signal: controller.signal,
    });

    if (!ollamaResponse.ok) {
      const detail = await ollamaResponse.text().catch(() => "");
      return NextResponse.json(
        { error: "Grading model request failed", detail },
        { status: 502 },
      );
    }

    const data = await ollamaResponse.json();
    const parsed = JSON.parse(data.message.content);

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = err instanceof Error && err.name === "AbortError" ? 504 : 500;
    return NextResponse.json({ error: "Grading failed", detail: message }, { status });
  } finally {
    clearTimeout(timeout);
    activeRequests--;
  }
}
