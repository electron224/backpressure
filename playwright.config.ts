// playwright.config.ts
import { defineConfig } from "@playwright/test";

// E2E runs against a built app (`next start`), not dev: matches CI, avoids
// HMR nondeterminism, and costs nothing since the build is a PR gate.
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3111",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --filter @backpressure/web exec next start -p 3111",
    url: "http://localhost:3111",
    reuseExistingServer: true,
    timeout: 90_000,
    // E2E is a deterministic gate: no live LLM, no Postgres. Provider keys
    // are stripped so coach routes always take the documented fallback.
    env: {
      ANTHROPIC_API_KEY: "",
      OPENAI_API_KEY: "",
      GOOGLE_GENERATIVE_AI_API_KEY: "",
      GEMINI_API_KEY: "",
      COACH_PROVIDER: "",
      TRUST_HOST: "true",
      AUTH_SECRET: "e2e-test-secret-not-used-for-real-sessions",
    },
  },
});
