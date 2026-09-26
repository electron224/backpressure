// packages/coach/src/llm.ts
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Topology } from "@backpressure/concept-engine";
import { buildProvider, selectProviderName } from "./providers.js";
import type { ProviderEnv } from "./providers.js";

// Server-only module: never import from client components. The API key
// stays here. Bump RUBRIC_VERSION whenever prompts/ change so cached
// grades invalidate.
export const RUBRIC_VERSION = "v1";
const MAX_SESSION_USD = 0.5;
const MAX_TOKENS = 800;

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

function hashKey(provider: string, model: string, input: Omit<CoachInput, "attemptId" | "transcript">): string {
  return createHash("sha256")
    .update(JSON.stringify([provider, model, input.problem, input.phase, input.topology, input.weakness, input.structural, input.verdicts, RUBRIC_VERSION]))
    .digest("hex");
}

const cache = new Map<string, CoachFeedback>();
const spendByAttempt = new Map<string, number>();

function fallback(): CoachFeedback {
  return {
    summary: "Coach unavailable: set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY to enable grounded deep-dive probes. Deterministic grades above stand on their own.",
    probes: [{ question: "What number in your run most surprised you, and why?", why: "Self-review without a model fallback." }],
  };
}

function fenceLearnerData(input: CoachInput): string {
  return `<learner-data>\n${JSON.stringify({ topology: input.topology, transcript: input.transcript })}\n</learner-data>`;
}

export const AssistantAnswerSchema = z.object({
  answer: z.string().min(1),
  followUps: z.array(z.string().min(1)).max(3),
});

export type AssistantAnswer = z.infer<typeof AssistantAnswerSchema>;

export interface AskInput {
  question: string;
  page: { kind: string; slug: string; title: string; summary: string };
  history: { role: "user" | "assistant"; text: string }[];
  attemptId: string;
}

export interface AskResult {
  answer: AssistantAnswer;
  cached: boolean;
  grounded: boolean;
}

function loadAssistantPrompt(): string {
  return readFileSync(join(here, "..", "prompts", "v1", "assistant.md"), "utf8");
}

function askFallback(): AssistantAnswer {
  return {
    answer:
      "Coach unavailable: add a provider key in Settings (kept for this session only, never stored) to enable grounded answers.",
    followUps: ["Run the lab once, then ask what surprised you."],
  };
}

export async function coachAsk(input: AskInput, env?: ProviderEnv): Promise<AskResult> {
  const providerName = selectProviderName(env);
  if (providerName === null) return { answer: askFallback(), cached: false, grounded: false };
  const provider = buildProvider(providerName, env);
  const key = createHash("sha256")
    .update(JSON.stringify([provider.name, provider.model, input.page, input.question, RUBRIC_VERSION]))
    .digest("hex");
  const hit = askCache.get(key);
  if (hit !== undefined) return { answer: hit, cached: true, grounded: true };

  const spent = spendByAttempt.get(input.attemptId) ?? 0;
  if (spent >= MAX_SESSION_USD) {
    throw new Error(`coach budget exhausted for attempt ${input.attemptId} (cap $${MAX_SESSION_USD})`);
  }

  const history = input.history
    .slice(-6)
    .map((entry) => `${entry.role === "user" ? "Learner" : "Coach"}: ${entry.text}`)
    .join("\n");
  const prompt = `${loadAssistantPrompt()}\n\nPAGE: ${JSON.stringify(input.page)}\nHISTORY:\n${history}\n${fenceLearnerText(
    input.question,
  )}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const completion = await provider.complete(prompt, MAX_TOKENS);
    const parsed = AssistantAnswerSchema.safeParse(extractJson(completion.text));
    if (parsed.success) {
      spendByAttempt.set(input.attemptId, spent + provider.priceUsd(completion.inputTokens, completion.outputTokens));
      askCache.set(key, parsed.data);
      return { answer: parsed.data, cached: false, grounded: true };
    }
  }
  return { answer: askFallback(), cached: false, grounded: false };
}

const askCache = new Map<string, AssistantAnswer>();

function fenceLearnerText(question: string): string {
  return `<learner-data>\n${JSON.stringify({ question })}\n</learner-data>`;
}

export async function coachDeepDive(input: CoachInput, env?: ProviderEnv): Promise<CoachResult> {
  const providerName = selectProviderName(env);
  if (providerName === null) return { feedback: fallback(), cached: false, grounded: false };
  const provider = buildProvider(providerName, env);
  const key = hashKey(provider.name, provider.model, input);
  const hit = cache.get(key);
  if (hit !== undefined) return { feedback: hit, cached: true, grounded: true };

  const spent = spendByAttempt.get(input.attemptId) ?? 0;
  if (spent >= MAX_SESSION_USD) {
    throw new Error(`coach budget exhausted for attempt ${input.attemptId} (cap $${MAX_SESSION_USD})`);
  }

  const prompt = `${loadPrompt()}\n\nPROBLEM: ${input.problem}\nPHASE: ${input.phase}\nWEAKNESS: ${
    input.weakness
  }\nSTRUCTURAL: ${JSON.stringify(input.structural)}\nVERDICTS: ${JSON.stringify(input.verdicts)}\n${fenceLearnerData(input)}`;

  let raw = "";
  let completion = { text: "", inputTokens: 0, outputTokens: 0 };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    completion = await provider.complete(prompt, MAX_TOKENS);
    raw = completion.text;
    const parsed = CoachFeedbackSchema.safeParse(extractJson(raw));
    if (parsed.success) {
      const cost = provider.priceUsd(completion.inputTokens, completion.outputTokens);
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
