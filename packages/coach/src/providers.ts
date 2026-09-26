// packages/coach/src/providers.ts
import Anthropic from "@anthropic-ai/sdk";

// Server-only: providers hold API keys. One interface, three backends.
// OpenAI-compatible endpoints (OpenRouter, Ollama, vLLM, Together) work
// through OPENAI_BASE_URL without new code or dependencies.
export type ProviderName = "anthropic" | "openai" | "google";

export interface ProviderCompletion {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ChatProvider {
  name: ProviderName;
  model: string;
  complete: (prompt: string, maxTokens: number) => Promise<ProviderCompletion>;
  priceUsd: (inputTokens: number, outputTokens: number) => number;
}

export interface ProviderEnv {
  ANTHROPIC_API_KEY?: string | undefined;
  OPENAI_API_KEY?: string | undefined;
  OPENAI_BASE_URL?: string | undefined;
  OPENAI_MODEL?: string | undefined;
  GOOGLE_GENERATIVE_AI_API_KEY?: string | undefined;
  GEMINI_API_KEY?: string | undefined;
  GEMINI_MODEL?: string | undefined;
  ANTHROPIC_MODEL?: string | undefined;
  COACH_PROVIDER?: string | undefined;
}

function readEnv(): ProviderEnv {
  return {
    ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"],
    OPENAI_API_KEY: process.env["OPENAI_API_KEY"],
    OPENAI_BASE_URL: process.env["OPENAI_BASE_URL"],
    OPENAI_MODEL: process.env["OPENAI_MODEL"],
    GOOGLE_GENERATIVE_AI_API_KEY: process.env["GOOGLE_GENERATIVE_AI_API_KEY"],
    GEMINI_API_KEY: process.env["GEMINI_API_KEY"],
    GEMINI_MODEL: process.env["GEMINI_MODEL"],
    ANTHROPIC_MODEL: process.env["ANTHROPIC_MODEL"],
    COACH_PROVIDER: process.env["COACH_PROVIDER"],
  };
}

function configured(name: ProviderName, env: ProviderEnv): boolean {
  if (name === "anthropic") return (env.ANTHROPIC_API_KEY?.length ?? 0) > 0;
  if (name === "openai") return (env.OPENAI_API_KEY?.length ?? 0) > 0;
  return ((env.GOOGLE_GENERATIVE_AI_API_KEY?.length ?? 0) > 0) || ((env.GEMINI_API_KEY?.length ?? 0) > 0);
}

// Explicit choice wins when configured; otherwise first configured in
// anthropic -> openai -> google order; null means deterministic fallback.
export function selectProviderName(env: ProviderEnv = readEnv()): ProviderName | null {
  const wanted = env.COACH_PROVIDER?.trim().toLowerCase();
  if (wanted === "anthropic" || wanted === "openai" || wanted === "google") {
    return configured(wanted, env) ? wanted : null;
  }
  const order: ProviderName[] = ["anthropic", "openai", "google"];
  return order.find((name) => configured(name, env)) ?? null;
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`provider HTTP ${response.status} from ${url}`);
  }
  return (await response.json()) as unknown;
}

function anthropicProvider(apiKey: string, model: string): ChatProvider {
  const client = new Anthropic({ apiKey });
  return {
    name: "anthropic",
    model,
    complete: async (prompt, maxTokens) => {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      const text = response.content
        .filter((block): block is { type: "text"; text: string } => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      return { text, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
    },
    priceUsd: (inputTokens, outputTokens) => (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15,
  };
}

function openaiProvider(apiKey: string, model: string, baseUrl: string): ChatProvider {
  const endpoint = baseUrl.replace(/\/$/, "") + "/chat/completions";
  return {
    name: "openai",
    model,
    complete: async (prompt, maxTokens) => {
      const body = await postJson(
        endpoint,
        { authorization: `Bearer ${apiKey}` },
        { model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] },
      );
      if (typeof body !== "object" || body === null || !("choices" in body)) {
        throw new Error("openai-compatible response has no choices");
      }
      const choices = (body as { choices: unknown }).choices;
      if (!Array.isArray(choices) || choices.length === 0) throw new Error("openai-compatible response is empty");
      const first = choices[0] as { message?: { content?: unknown } };
      const text = typeof first.message?.content === "string" ? first.message.content : "";
      const usage = (body as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } }).usage;
      const inputTokens = typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : 0;
      const outputTokens = typeof usage?.completion_tokens === "number" ? usage.completion_tokens : 0;
      return { text, inputTokens, outputTokens };
    },
    priceUsd: (inputTokens, outputTokens) => (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.6,
  };
}

function googleProvider(apiKey: string, model: string): ChatProvider {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  return {
    name: "google",
    model,
    complete: async (prompt, maxTokens) => {
      const body = await postJson(
        endpoint,
        { "x-goog-api-key": apiKey },
        { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } },
      );
      if (typeof body !== "object" || body === null || !("candidates" in body)) {
        throw new Error("gemini response has no candidates");
      }
      const candidates = (body as { candidates: unknown }).candidates;
      if (!Array.isArray(candidates) || candidates.length === 0) throw new Error("gemini response is empty");
      const first = candidates[0] as { content?: { parts?: { text?: unknown }[] } };
      const text = first.content?.parts?.map((part) => (typeof part.text === "string" ? part.text : "")).join("\n") ?? "";
      const usage = (body as { usageMetadata?: { promptTokenCount?: unknown; candidatesTokenCount?: unknown } })
        .usageMetadata;
      const inputTokens = typeof usage?.promptTokenCount === "number" ? usage.promptTokenCount : 0;
      const outputTokens = typeof usage?.candidatesTokenCount === "number" ? usage.candidatesTokenCount : 0;
      return { text, inputTokens, outputTokens };
    },
    priceUsd: (inputTokens, outputTokens) => (inputTokens / 1_000_000) * 0.1 + (outputTokens / 1_000_000) * 0.4,
  };
}

export function buildProvider(name: ProviderName, env: ProviderEnv = readEnv()): ChatProvider {
  if (name === "anthropic") {
    const apiKey = env.ANTHROPIC_API_KEY ?? "";
    return anthropicProvider(apiKey, env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514");
  }
  if (name === "openai") {
    const apiKey = env.OPENAI_API_KEY ?? "";
    return openaiProvider(apiKey, env.OPENAI_MODEL ?? "gpt-4o-mini", env.OPENAI_BASE_URL ?? "https://api.openai.com/v1");
  }
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY ?? env.GEMINI_API_KEY ?? "";
  return googleProvider(apiKey, env.GEMINI_MODEL ?? "gemini-2.0-flash");
}
