// packages/coach/src/llm.ts
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Topology } from "@backpressure/concept-engine";

// Server-only module: never import from client components. The API key
// stays here. Bump RUBRIC_VERSION whenever prompts/ change so cached
// grades invalidate.
export const RUBRIC_VERSION = "v1";
const MODEL = "claude-sonnet-4-20250514";
const MAX_SESSION_USD = 0.5;
const INPUT_USD_PER_MTOK = 3;
const OUTPUT_USD_PER_MTOK = 15;

export const CoachFeedbackSchema = z.object({
  summary: z.string().min(1),
  probes: z
    .array(z.object({ question: z.string().min(1), why: z.string().min(1) }))
    .min(1)
    .max(4),
});

export type CoachFeedback = z.infer<typeof CoachFeedbackSchema>;

export interface CoachInput {
  problem: string;
  phase: string;
  topology: Topology;
  weakness: string;
  structural: { id: string; passed: boolean; detail: string }[];
  verdicts: { id: string; passed: boolean; observed: number }[];
  transcript: { phase: string; payload: unknown }[];
  attemptId: string;
}

export interface CoachResult {
  feedback: CoachFeedback;
  cached: boolean;
  grounded: boolean;
}

const here = dirname(fileURLToPath(import.meta.url));

function loadPrompt(): string {
  return readFileSync(join(here, "..", "prompts", "v1", "deep-dive.md"), "utf8");
}

function hashKey(input: Omit<CoachInput, "attemptId" | "transcript">): string {
  return createHash("sha256")
    .update(JSON.stringify([input.problem, input.phase, input.topology, input.weakness, input.structural, input.verdicts, RUBRIC_VERSION, MODEL]))
    .digest("hex");
}

const cache = new Map<string, CoachFeedback>();
const spendByAttempt = new Map<string, number>();

function fallback(): CoachFeedback {
  return {
    summary: "Coach unavailable: set ANTHROPIC_API_KEY to enable grounded deep-dive probes. Deterministic grades above stand on their own.",
    probes: [{ question: "What number in your run most surprised you, and why?", why: "Self-review without a model fallback." }],
  };
}

function fenceLearnerData(input: CoachInput): string {
  return `<learner-data>\n${JSON.stringify({ topology: input.topology, transcript: input.transcript })}\n</learner-data>`;
}

export async function coachDeepDive(input: CoachInput): Promise<CoachResult> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) return { feedback: fallback(), cached: false, grounded: false };
  const key = hashKey(input);
  const hit = cache.get(key);
  if (hit !== undefined) return { feedback: hit, cached: true, grounded: true };

  const spent = spendByAttempt.get(input.attemptId) ?? 0;
  if (spent >= MAX_SESSION_USD) {
    throw new Error(`coach budget exhausted for attempt ${input.attemptId} (cap $${MAX_SESSION_USD})`);
  }

  const prompt = `${loadPrompt()}\n\nPROBLEM: ${input.problem}\nPHASE: ${input.phase}\nWEAKNESS: ${
    input.weakness
  }\nSTRUCTURAL: ${JSON.stringify(input.structural)}\nVERDICTS: ${JSON.stringify(input.verdicts)}\n${fenceLearnerData(input)}`;
  const client = new Anthropic({ apiKey });

  let raw = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    raw = response.content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    const parsed = CoachFeedbackSchema.safeParse(extractJson(raw));
    if (parsed.success) {
      const usage = response.usage;
      const cost =
        (usage.input_tokens / 1_000_000) * INPUT_USD_PER_MTOK + (usage.output_tokens / 1_000_000) * OUTPUT_USD_PER_MTOK;
      spendByAttempt.set(input.attemptId, spent + cost);
      cache.set(key, parsed.data);
      return { feedback: parsed.data, cached: false, grounded: true };
    }
  }
  return { feedback: fallback(), cached: false, grounded: false };
}

function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return raw;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as unknown;
  } catch {
    return raw;
  }
}
