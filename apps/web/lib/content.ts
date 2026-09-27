import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ConceptMetaSchema, RecallItemsSchema } from "@backpressure/concept-engine";
import type { ConceptMeta, RecallItem } from "@backpressure/concept-engine";

const CONCEPTS_DIR = join(process.cwd(), "..", "..", "content", "concepts");

export interface ConceptContent {
  meta: ConceptMeta;
  learnMdx: string;
  recall: RecallItem[];
}

function readJson(path: string): unknown {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return parsed;
  } catch (error) {
    throw new Error(`concept content unreadable at ${path}: ${String(error)}`);
  }
}

export function getConcept(slug: string): ConceptContent {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`invalid concept slug: ${slug}`);
  const dir = join(CONCEPTS_DIR, slug);
  const meta = ConceptMetaSchema.parse(readJson(join(dir, "meta.json")));
  const recall = RecallItemsSchema.parse(readJson(join(dir, "recall.json")));
  let learnMdx: string;
  try {
    learnMdx = readFileSync(join(dir, "learn.mdx"), "utf8");
  } catch (error) {
    throw new Error(`concept content unreadable at ${dir}/learn.mdx: ${String(error)}`);
  }
  return { meta, learnMdx, recall };
}
