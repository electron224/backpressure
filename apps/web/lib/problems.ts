// apps/web/lib/problems.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GradeDimension, ScenarioDef } from "@backpressure/coach/grade-core";

const PROBLEMS_DIR = join(process.cwd(), "..", "..", "content", "problems");

function readText(slug: string, file: string): string {
  try {
    return readFileSync(join(PROBLEMS_DIR, slug, file), "utf8");
  } catch (error) {
    throw new Error(`problem content unreadable at ${slug}/${file}: ${String(error)}`);
  }
}

function readJson(slug: string, file: string): unknown {
  try {
    return JSON.parse(readFileSync(join(PROBLEMS_DIR, slug, file), "utf8")) as unknown;
  } catch (error) {
    throw new Error(`problem content unreadable at ${slug}/${file}: ${String(error)}`);
  }
}

export interface ProblemContent {
  meta: { id: string; title: string; concepts_required: string[] };
  briefMdx: string;
  clarifications: { q: string; a: string }[];
  scale: Record<string, number | string>;
  rubric: { dimensions: GradeDimension[] };
  scenarios: ScenarioDef[];
}

export function getProblem(slug: string): ProblemContent {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`invalid problem slug: ${slug}`);
  return {
    meta: readJson(slug, "meta.json") as ProblemContent["meta"],
    briefMdx: readText(slug, "brief.mdx"),
    clarifications: readJson(slug, "clarifications.json") as ProblemContent["clarifications"],
    scale: readJson(slug, "scale.json") as ProblemContent["scale"],
    rubric: readJson(slug, "rubric.json") as ProblemContent["rubric"],
    scenarios: readJson(slug, "scenarios.json") as ProblemContent["scenarios"],
  };
}
