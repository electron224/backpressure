// packages/coach/tests/providers.test.ts
import { describe, expect, it } from "vitest";
import { buildProvider, selectProviderName } from "../src/providers.js";
import type { ProviderEnv } from "../src/providers.js";

const EMPTY: ProviderEnv = {};

describe("selectProviderName", () => {
  it("returns null with no keys (deterministic fallback)", () => {
    expect(selectProviderName(EMPTY)).toBeNull();
  });

  it("prefers anthropic, then openai, then google", () => {
    expect(selectProviderName({ OPENAI_API_KEY: "x" })).toBe("openai");
    expect(selectProviderName({ GEMINI_API_KEY: "x" })).toBe("google");
    expect(selectProviderName({ GOOGLE_GENERATIVE_AI_API_KEY: "x" })).toBe("google");
    expect(selectProviderName({ ANTHROPIC_API_KEY: "x", OPENAI_API_KEY: "y" })).toBe("anthropic");
  });

  it("honors an explicit configured choice, rejects unconfigured", () => {
    expect(selectProviderName({ COACH_PROVIDER: "google", GEMINI_API_KEY: "x" })).toBe("google");
    expect(selectProviderName({ COACH_PROVIDER: "openai" })).toBeNull();
    expect(selectProviderName({ COACH_PROVIDER: "unknown", OPENAI_API_KEY: "x" })).toBe("openai");
  });
});

describe("buildProvider", () => {
  it("names models and prices sane orders of magnitude", () => {
    const anthropic = buildProvider("anthropic", { ANTHROPIC_API_KEY: "x" });
    expect(anthropic.model).toContain("claude");
    expect(anthropic.priceUsd(1_000_000, 1_000_000)).toBeCloseTo(12, 0);
    const openai = buildProvider("openai", { OPENAI_API_KEY: "x" });
    expect(openai.priceUsd(1_000_000, 1_000_000)).toBeLessThan(anthropic.priceUsd(1_000_000, 1_000_000));
    const google = buildProvider("google", { GEMINI_API_KEY: "x" });
    expect(google.model).toContain("gemini");
  });

  it("honors endpoint and model overrides", () => {
    const custom = buildProvider("openai", {
      OPENAI_API_KEY: "x",
      OPENAI_BASE_URL: "https://openrouter.ai/api/v1",
      OPENAI_MODEL: "meta-llama/llama-3-70b",
    });
    expect(custom.model).toBe("meta-llama/llama-3-70b");
  });
});
