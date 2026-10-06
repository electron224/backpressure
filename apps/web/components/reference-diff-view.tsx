// apps/web/components/reference-diff-view.tsx
import { diffAgainstReference, summarizeDiff } from "@backpressure/coach/reference-diff";
import type { ReferenceDiffEntry } from "@backpressure/coach/reference-diff";
import type { Topology } from "@backpressure/concept-engine";
import type { ReferenceArchitecture } from "../lib/references";

// Renders the deterministic diff. Every line is a trade-off with a
// "why" — never a score. The grader owns scoring; this only names
// what differs and what it buys.
function EntryRow({ entry }: { entry: ReferenceDiffEntry }): JSX.Element {
  return (
    <li className="border-b border-ink/10 py-2">
      <span className="font-mono text-xs uppercase tracking-wide text-smoke">{entry.side === "only-reference" ? "reference only" : "yours only"}</span>{" "}
      <span className="font-mono font-bold">{entry.kind}</span>
      <span className="text-sm text-smoke"> — {entry.detail}</span>
      <p className="mt-1 text-sm leading-relaxed">{entry.why}</p>
    </li>
  );
}

export function ReferenceDiffView({
  theirs,
  references,
}: {
  theirs: Topology;
  references: ReferenceArchitecture[];
}): JSX.Element {
  if (references.length === 0) return <></>;
  return (
    <div className="mt-4 max-w-2xl">
      <h3 className="font-bold">Diff against reference</h3>
      <p className="mt-1 text-sm text-smoke">
        Deterministic component-by-component comparison. Not a score — each line names a trade-off and what it buys.
      </p>
      {references.map((reference) => {
        const diff = diffAgainstReference(theirs, reference.topology);
        return (
          <div key={reference.id} className="mt-4 border-t border-ink/20 pt-3">
            <p className="font-mono text-sm">
              {reference.label} <span className="text-smoke">— {summarizeDiff(diff)}</span>
            </p>
            {diff.entries.length > 0 && (
              <ul className="mt-2">
                {diff.entries.map((entry, i) => (
                  <EntryRow key={`${entry.side}-${entry.kind}-${i}`} entry={entry} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
