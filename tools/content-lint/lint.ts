// tools/content-lint/lint.ts — validates content/ against Zod schemas + cross-file rules.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ConceptMetaSchema, ChallengesSchema, RecallItemsSchema, LabPresetSchema } from "@backpressure/concept-engine";
import { CHECKS } from "@backpressure/coach";

const ROOT = join(process.cwd(), "content", "concepts");
const PROBLEMS = join(process.cwd(), "content", "problems");

let failures = 0;

function fail(message: string): void {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    fail(`unreadable ${path}: ${String(error)}`);
    return undefined;
  }
}

function checkConcept(slug: string): void {
  const dir = join(ROOT, slug);
  for (const file of ["meta.json", "learn.mdx", "lab.ts", "challenges.json", "recall.json"]) {
    if (!existsSync(join(dir, file))) fail(`${slug}: missing ${file}`);
  }
  const meta = readJson(join(dir, "meta.json"));
  if (meta !== undefined) {
    const parsed = ConceptMetaSchema.safeParse(meta);
    if (!parsed.success) fail(`${slug}/meta.json: ${parsed.error.message}`);
    else if (parsed.data.id !== slug) fail(`${slug}/meta.json id mismatch`);
  }
  const challenges = readJson(join(dir, "challenges.json"));
  if (challenges !== undefined && !ChallengesSchema.safeParse(challenges).success) {
    fail(`${slug}/challenges.json: schema violation`);
  }
  const recall = readJson(join(dir, "recall.json"));
  if (recall !== undefined && !RecallItemsSchema.safeParse(recall).success) {
    fail(`${slug}/recall.json: schema violation`);
  }
  try {
    const mdx = readFileSync(join(dir, "learn.mdx"), "utf8");
    const words = mdx.split(/\s+/).filter((w) => w.length > 0).length;
    if (words > 600) fail(`${slug}/learn.mdx: ${words} words over 600 limit`);
  } catch {
    // Missing file already reported.
  }
}

function checkProblem(slug: string): void {
  const dir = join(PROBLEMS, slug);
  for (const file of ["meta.json", "brief.mdx", "clarifications.json", "scale.json", "rubric.json", "scenarios.json"]) {
    if (!existsSync(join(dir, file))) fail(`problem ${slug}: missing ${file}`);
  }
  const rubric = readJson(join(dir, "rubric.json")) as
    | { dimensions?: { criteria?: { check?: string }[] }[] }
    | undefined;
  for (const dimension of rubric?.dimensions ?? []) {
    for (const criterion of dimension.criteria ?? []) {
      if (criterion.check !== undefined && CHECKS[criterion.check] === undefined) {
        fail(`problem ${slug}: unregistered check '${criterion.check}'`);
      }
    }
  }
}

for (const slug of readdirSync(ROOT)) checkConcept(slug);
for (const slug of readdirSync(PROBLEMS)) checkProblem(slug);

// Lab presets are TS modules: import, validate, and check the embedded
// challenges mirror challenges.json (single source would be better;
// the mirror is pinned here until content:lint owns it).
for (const slug of readdirSync(ROOT)) {
  try {
    const mod = (await import(join(ROOT, slug, "lab.ts"))) as { labPreset?: unknown };
    const parsed = LabPresetSchema.safeParse(mod.labPreset);
    if (!parsed.success) {
      fail(`${slug}/lab.ts: ${parsed.error.message}`);
      continue;
    }
    const fileChallenges: unknown = JSON.parse(readFileSync(join(ROOT, slug, "challenges.json"), "utf8"));
    if (JSON.stringify(fileChallenges) !== JSON.stringify(parsed.data.challenges)) {
      fail(`${slug}: lab.ts challenges diverge from challenges.json`);
    }
  } catch (error) {
    fail(`${slug}/lab.ts: ${String(error)}`);
  }
}

if (failures > 0) {
  console.error(`${failures} content problem(s) found`);
  process.exit(1);
}
console.log("content: all concepts and problems valid");
