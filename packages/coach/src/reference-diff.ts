// packages/coach/src/reference-diff.ts
import type { Topology } from "@backpressure/concept-engine";

// Diff-against-reference (AGENTS §8 #5): deterministic set comparison of
// the learner's topology against a reference architecture. Never invents
// scores; every line names a trade-off and what it buys.

export interface ReferenceDiffEntry {
  side: "only-yours" | "only-reference";
  kind: string;
  detail: string;
  why: string;
}

export interface ReferenceDiff {
  entries: ReferenceDiffEntry[];
  missingKinds: string[];
  extraKinds: string[];
}

// Component-level annotations: why a component exists and what it buys,
// phrased as a trade-off, not a verdict. Kinds come from the canvas
// palette, so the map covers every node the learner can draw.
const WHY: Record<string, string> = {
  lb: "Load balancing pools capacity across backends; a second service survives one instance dying.",
  service: "Services hold the request path; every hop adds latency, so the count matters.",
  "rate-limiter": "Rate limiting sheds load before it saturates the fleet; it buys protection at the cost of rejecting some traffic.",
  cache: "A cache absorbs repeated reads; it buys latency and origin relief at the cost of possible staleness.",
  database: "Databases hold durable state; a single instance is a durability and availability bottleneck.",
  "shard-router": "Sharding spreads load across data partitions; it buys scale at the cost of hot-shard risk.",
  dedup: "Dedup collapses retries and replays; it buys lower write load at the cost of tracking keys.",
  pipe: "Pipes connect stages; they buy isolation between components at the cost of an extra hop.",
  queue: "Queues buffer bursts; they buy backpressure at the cost of added latency and operational depth.",
  "fan-out": "Fan-out writes to many consumers; it buys broadcast at the cost of write amplification.",
};

function whyFor(kind: string): string {
  return WHY[kind] ?? "Component in the canvas palette; no annotation recorded for this kind.";
}

// Matching is per-kind and order-independent: learners name nodes their
// own way, so identity is the component kind, not the id. Duplicate
// kinds on one side pair off one-to-one; the leftovers are the diff.
function countKinds(topology: Topology): Map<string, number> {
  const counts = new Map<string, number>();
  for (const node of topology.nodes) {
    counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
  }
  return counts;
}

export function diffAgainstReference(theirs: Topology, reference: Topology): ReferenceDiff {
  const mine = countKinds(theirs);
  const ref = countKinds(reference);
  const kinds = new Set([...mine.keys(), ...ref.keys()]);

  const entries: ReferenceDiffEntry[] = [];
  const missingKinds: string[] = [];
  const extraKinds: string[] = [];

  for (const kind of kinds) {
    const have = mine.get(kind) ?? 0;
    const want = ref.get(kind) ?? 0;
    if (have === want) continue;
    if (have < want) {
      for (let i = 0; i < want - have; i += 1) {
        entries.push({ side: "only-reference", kind, detail: `reference runs ${want}, yours runs ${have}`, why: whyFor(kind) });
        missingKinds.push(kind);
      }
    } else {
      for (let i = 0; i < have - want; i += 1) {
        entries.push({ side: "only-yours", kind, detail: `yours runs ${have}, reference runs ${want}`, why: whyFor(kind) });
        extraKinds.push(kind);
      }
    }
  }

  return { entries, missingKinds, extraKinds };
}

// A topology with no reference counterpart is a design choice, not an
// error: the diff reports it as a trade-off and leaves scoring to the
// deterministic grader.
export function summarizeDiff(diff: ReferenceDiff): string {
  if (diff.entries.length === 0) return "Same component mix as the reference. Differences, if any, are in the wiring and configs.";
  const missing = new Set(diff.missingKinds).size;
  const extra = new Set(diff.extraKinds).size;
  return `${diff.entries.length} component difference${diff.entries.length === 1 ? "" : "s"} (${missing} fewer kind${missing === 1 ? "" : "s"}, ${extra} extra kind${extra === 1 ? "" : "s"}) than the reference.`;
}
