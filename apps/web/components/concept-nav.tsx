// apps/web/components/concept-nav.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function isComplete(slug: string): boolean {
  try {
    const raw = window.localStorage.getItem(`bp:${slug}`);
    if (raw === null) return false;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return false;
    const stages = (parsed as { stages?: unknown }).stages;
    return Array.isArray(stages) && stages.includes("recall");
  } catch {
    return false;
  }
}

export function ConceptNav({
  slug,
  prerequisites,
  next,
}: {
  slug: string;
  prerequisites: string[];
  next: { slug: string; title: string } | null;
}): JSX.Element {
  const [missing, setMissing] = useState<string[] | null>(null);

  useEffect(() => {
    setMissing(prerequisites.filter((req) => !isComplete(req)));
  }, [prerequisites, slug]);

  return (
    <div>
      {missing !== null && missing.length > 0 && (
        <p className="mt-4 border border-ember/40 px-3 py-2 text-sm">
          Recommended first: {missing.join(", ")} — this lab assumes them.
        </p>
      )}
      {next !== null && (
        <p className="mt-6 border-t border-ink/20 pt-4">
          Next:{" "}
          <Link href={`/concepts/${next.slug}`} className="hover:text-ember">
            {next.title}
          </Link>
        </p>
      )}
    </div>
  );
}
