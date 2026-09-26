// apps/web/components/progress-view.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface ProgressConcept {
  slug: string;
  title: string;
}

export interface ProgressProblem {
  slug: string;
  title: string;
  required: string[];
}

function readStages(slug: string): string[] {
  try {
    const raw = window.localStorage.getItem(`bp:${slug}`);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return [];
    const stages = (parsed as { stages?: unknown }).stages;
    return Array.isArray(stages) ? stages.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function countPredictions(slug: string): number {
  try {
    const raw = window.localStorage.getItem(`bp:${slug}`);
    if (raw === null) return 0;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return 0;
    const predictions = (parsed as { predictions?: unknown }).predictions;
    return Array.isArray(predictions) ? predictions.length : 0;
  } catch {
    return 0;
  }
}

export function ProgressView({
  tracks,
  problems,
}: {
  tracks: { title: string; concepts: ProgressConcept[] }[];
  problems: ProgressProblem[];
}): JSX.Element {
  const [stages, setStages] = useState<Record<string, string[]>>({});
  const [predictions, setPredictions] = useState<Record<string, number>>({});

  useEffect(() => {
    const stageMap: Record<string, string[]> = {};
    const predictionMap: Record<string, number> = {};
    for (const track of tracks) {
      for (const concept of track.concepts) {
        stageMap[concept.slug] = readStages(concept.slug);
        predictionMap[concept.slug] = countPredictions(concept.slug);
      }
    }
    setStages(stageMap);
    setPredictions(predictionMap);
  }, [tracks]);

  const ordered = tracks.flatMap((track) => track.concepts.map((concept) => concept.slug));
  const nextSlug = ordered.find((slug) => !(stages[slug] ?? []).includes("recall")) ?? null;
  const done = ordered.filter((slug) => (stages[slug] ?? []).includes("recall")).length;

  return (
    <div>
      <section aria-label="Summary" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">Where you stand</h2>
        <p className="mt-3 font-mono text-sm">
          {done}/{ordered.length} concepts complete
        </p>
        {nextSlug !== null && (
          <p className="mt-2">
            Next:{" "}
            <Link href={`/concepts/${nextSlug}`} className="hover:text-ember">
              {nextSlug}
            </Link>
          </p>
        )}
      </section>
      {tracks.map((track) => (
        <section key={track.title} aria-label={track.title} className="mt-8 border-t border-ink/20 pt-4">
          <h2 className="text-xl font-bold">{track.title}</h2>
          <ul className="mt-3 space-y-1 font-mono text-sm">
            {track.concepts.map((concept) => {
              const list = stages[concept.slug] ?? [];
              const count = predictions[concept.slug] ?? 0;
              return (
                <li key={concept.slug} className="border-b border-ink/10 pb-1">
                  <Link href={`/concepts/${concept.slug}`} className="hover:text-ember">
                    {concept.slug}
                  </Link>{" "}
                  — {list.length === 0 ? "not started" : list.join(", ")}
                  {count > 0 ? ` — ${count} predictions` : ""}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <section aria-label="Interview readiness" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">Interview readiness</h2>
        <ul className="mt-3 space-y-2">
          {problems.map((problem) => {
            const ready = problem.required.filter((slug) => (stages[slug] ?? []).includes("recall")).length;
            const pct = problem.required.length === 0 ? 0 : Math.round((ready / problem.required.length) * 100);
            return (
              <li key={problem.slug} className="border-b border-ink/10 pb-2">
                <Link href={`/problems/${problem.slug}`} className="hover:text-ember">
                  {problem.title}
                </Link>{" "}
                <span className="font-mono text-sm">
                  — {pct}% ({ready}/{problem.required.length} required labs)
                </span>
                {pct < 100 && <span className="block text-sm text-smoke">Finish the required labs first.</span>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
