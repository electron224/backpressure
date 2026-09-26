// apps/web/components/readiness-banner.tsx
"use client";

import { useEffect, useState } from "react";

export function ReadinessBanner({ required }: { required: string[] }): JSX.Element {
  const [ready, setReady] = useState<string[] | null>(null);

  useEffect(() => {
    const done: string[] = [];
    for (const slug of required) {
      try {
        const raw = window.localStorage.getItem(`bp:${slug}`);
        if (raw === null) continue;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) continue;
        const stages = (parsed as { stages?: unknown }).stages;
        if (Array.isArray(stages) && stages.includes("recall")) done.push(slug);
      } catch {
        // Unreadable progress counts as incomplete.
      }
    }
    setReady(done);
  }, [required]);

  if (ready === null) return <></>;
  if (ready.length >= required.length) return <></>;
  const missing = required.filter((slug) => !ready.includes(slug));
  return (
    <p className="mt-4 border border-ember/40 px-3 py-2 text-sm">
      Not ready yet: complete {missing.join(", ")} first ({ready.length}/{required.length} required labs done).
    </p>
  );
}
