import { NextResponse } from "next/server";
import { coachDeepDive } from "@backpressure/coach";
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
  if (!isTopology(input["topology"]) || typeof input["problem"] !== "string" || typeof input["attemptId"] !== "string") {
    return NextResponse.json({ error: "need problem, attemptId, and topology" }, { status: 400 });
  }
  const stringList = (value: unknown): { id: string; passed: boolean; detail: string }[] =>
    Array.isArray(value) ? value.filter((v): v is { id: string; passed: boolean; detail: string } => typeof v === "object" && v !== null) : [];
  const verdictList = (value: unknown): { id: string; passed: boolean; observed: number }[] =>
    Array.isArray(value)
      ? value.filter((v): v is { id: string; passed: boolean; observed: number } => typeof v === "object" && v !== null)
      : [];
  try {
    const result = await coachDeepDive({
      problem: input["problem"],
      phase: typeof input["phase"] === "string" ? input["phase"] : "deep-dive",
      topology: input["topology"],
      weakness: typeof input["weakness"] === "string" ? input["weakness"] : "availability",
      structural: stringList(input["structural"]),
      verdicts: verdictList(input["verdicts"]),
      transcript: Array.isArray(input["transcript"]) ? input["transcript"].map((entry) => ({ phase: "unknown", payload: entry })) : [],
      attemptId: input["attemptId"],
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("budget exhausted") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
