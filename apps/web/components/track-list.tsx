// apps/web/components/track-list.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface TrackConcept {
  slug: string;
  title: string;
  prerequisites: string[];
}

export interface TrackView {
  id: string;
  title: string;
  blurb: string;
  concepts: TrackConcept[];
}

interface ProgressState {
  stages: string[];
}

function readProgress(slug: string): ProgressState {
  try {
    const raw = window.localStorage.getItem(`bp:${slug}`);
    if (raw === null) return { stages: [] };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { stages: [] };
    const stages = (parsed as { stages?: unknown }).stages;
    return { stages: Array.isArray(stages) ? stages.filter((s): s is string => typeof s === "string") : [] };
  } catch {
    return { stages: [] };
  }
}

function isComplete(stages: string[]): boolean {
  return stages.includes("recall");
}

export function TrackList({ tracks }: { tracks: TrackView[] }): JSX.Element {
  const [progress, setProgress] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const next: Record<string, string[]> = {};
    for (const track of tracks) {
      for (const concept of track.concepts) {
        next[concept.slug] = readProgress(concept.slug).stages;
      }
    }
    setProgress(next);
  }, [tracks]);

  return (
    <div>
      {tracks.map((track, trackIndex) => (
        <section key={track.id} aria-label={track.title} className="mt-10 border-t border-ink/20 pt-4">
          <h2 className="text-xl font-bold">
            <span className="mr-3 font-mono text-sm font-normal text-smoke">{String(trackIndex + 1).padStart(2, "0")}</span>
            {track.title}
          </h2>
          <p className="mt-1 text-sm text-smoke">{track.blurb}</p>
          <ul className="mt-3">
            {track.concepts.map((concept) => {
              const stages = progress[concept.slug] ?? [];
              const done = isComplete(stages);
              const missing = concept.prerequisites.filter((req) => !isComplete(progress[req] ?? []));
              return (
                <li key={concept.slug} className="flex flex-wrap items-baseline gap-x-3 border-b border-ink/10 py-2">
                  <span className="font-mono text-sm" aria-label={done ? "completed" : stages.length > 0 ? "started" : "not started"}>
                    {done ? "done" : stages.length > 0 ? "started" : "todo"}
                  </span>
                  <Link href={`/concepts/${concept.slug}`} className="hover:text-ember">
                    {concept.title}
                  </Link>
                  {missing.length > 0 && (
                    <span className="text-sm text-smoke">needs: {missing.join(", ")}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
