import type { ReactElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getConcept } from "../../lib/content";
import { TRACKS } from "../../lib/tracks";
import { ProgressView } from "../../components/progress-view";

const PROBLEM_SLUGS = ["design-url-shortener", "design-twitter", "design-video"];

function problemMeta(slug: string): { title: string; required: string[] } {
  const meta: unknown = JSON.parse(
    readFileSync(join(process.cwd(), "..", "..", "content", "problems", slug, "meta.json"), "utf8"),
  );
  if (typeof meta !== "object" || meta === null) throw new Error(`bad meta for ${slug}`);
  const record = meta as { title?: unknown; concepts_required?: unknown };
  return {
    title: typeof record.title === "string" ? record.title : slug,
    required: Array.isArray(record.concepts_required)
      ? record.concepts_required.filter((s): s is string => typeof s === "string")
      : [],
  };
}

export default function ProgressPage(): ReactElement {
  const problems = PROBLEM_SLUGS.map((slug) => ({ slug, ...problemMeta(slug) }));
  const tracks = TRACKS.map((track) => ({
    title: track.title,
    concepts: track.slugs.map((slug) => ({ slug, title: getConcept(slug).meta.title })),
  }));
  return (
    <main>
      <p className="mt-8 font-mono text-sm text-smoke">your loop</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Progress</h1>
      <p className="mt-3 max-w-2xl leading-relaxed">
        Stages completed, predictions logged, and what to do next. Stored in this browser until accounts land.
      </p>
      <ProgressView tracks={tracks} problems={problems} />
    </main>
  );
}
