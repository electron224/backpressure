import { NextResponse } from "next/server";
import { coachAsk, coachDeepDive } from "@backpressure/coach";
import type { ProviderEnv } from "@backpressure/coach";
import type { Topology } from "@backpressure/concept-engine";

function isTopology(value: unknown): value is Topology {
  if (typeof value !== "object" || value === null) return false;
  const record = value as { nodes?: unknown; edges?: unknown };
  return Array.isArray(record.nodes) && Array.isArray(record.edges);
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: "request body must be JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "request body must be an object" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  // Session-only BYOK: keys arrive per request, are used server-side, and
  // are never persisted or logged.
  const sessionEnv: ProviderEnv = {};
  if (typeof input["provider"] === "string") {
    const name = input["provider"];
    if (name === "anthropic" && typeof input["apiKey"] === "string" && input["apiKey"].length > 0) {
      sessionEnv.ANTHROPIC_API_KEY = input["apiKey"];
      sessionEnv.COACH_PROVIDER = "anthropic";
    } else if (name === "openai" && typeof input["apiKey"] === "string" && input["apiKey"].length > 0) {
      sessionEnv.OPENAI_API_KEY = input["apiKey"];
      if (typeof input["baseUrl"] === "string" && input["baseUrl"].length > 0) sessionEnv.OPENAI_BASE_URL = input["baseUrl"];
      if (typeof input["model"] === "string" && input["model"].length > 0) sessionEnv.OPENAI_MODEL = input["model"];
      sessionEnv.COACH_PROVIDER = "openai";
    } else if (name === "google" && typeof input["apiKey"] === "string" && input["apiKey"].length > 0) {
      sessionEnv.GOOGLE_GENERATIVE_AI_API_KEY = input["apiKey"];
      if (typeof input["model"] === "string" && input["model"].length > 0) sessionEnv.GEMINI_MODEL = input["model"];
      sessionEnv.COACH_PROVIDER = "google";
    }
  }
  const hasSessionKey = Object.keys(sessionEnv).length > 0;
  if (input["mode"] === "ask") {
    if (typeof input["question"] !== "string" || input["question"].trim().length === 0) {
      return NextResponse.json({ error: "ask mode needs a question" }, { status: 400 });
    }
    const page = (input["page"] ?? {}) as { kind?: unknown; slug?: unknown; title?: unknown; summary?: unknown };
    try {
      const result = await coachAsk(
        {
          question: input["question"],
          page: {
            kind: typeof page.kind === "string" ? page.kind : "unknown",
            slug: typeof page.slug === "string" ? page.slug : "unknown",
            title: typeof page.title === "string" ? page.title : "unknown",
            summary: typeof page.summary === "string" ? page.summary : "",
          },
          history: Array.isArray(input["history"])
            ? input["history"]
                .filter((h): h is { role: string; text: string } => typeof h === "object" && h !== null)
                .filter((h) => (h.role === "user" || h.role === "assistant") && typeof h.text === "string")
                .map((h) => ({ role: h.role as "user" | "assistant", text: h.text }))
            : [],
          attemptId: typeof input["attemptId"] === "string" ? input["attemptId"] : "assistant",
        },
        hasSessionKey ? sessionEnv : undefined,
      );
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message.includes("budget exhausted") ? 429 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }
  if (!isTopology(input["topology"]) || typeof input["problem"] !== "string" || typeof input["attemptId"] !== "string") {
    return NextResponse.json({ error: "need problem, attemptId, and topology" }, { status: 400 });
  }
  const stringList = (value: unknown): { id: string; passed: boolean; detail: string }[] =>
    Array.isArray(value) ? value.filter((v): v is { id: string; passed: boolean; detail: string } => typeof v === "object" && v !== null) : [];
  const verdictList = (value: unknown): { id: string; passed: boolean; observed: number }[] =>
    Array.isArray(value)
      ? value.filter((v): v is { id: string; passed: boolean; observed: number } => typeof v === "object" && v !== null)
      : [];
  if (typeof input["problem"] !== "string" || typeof input["attemptId"] !== "string") {
    return NextResponse.json({ error: "need problem, attemptId, and topology" }, { status: 400 });
  }
  try {
    const result = await coachDeepDive(
      {
        problem: input["problem"],
        phase: typeof input["phase"] === "string" ? input["phase"] : "deep-dive",
        topology: input["topology"],
        weakness: typeof input["weakness"] === "string" ? input["weakness"] : "availability",
        structural: stringList(input["structural"]),
        verdicts: verdictList(input["verdicts"]),
        transcript: Array.isArray(input["transcript"]) ? input["transcript"].map((entry) => ({ phase: "unknown", payload: entry })) : [],
        attemptId: input["attemptId"],
      },
      hasSessionKey ? sessionEnv : undefined,
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("budget exhausted") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
