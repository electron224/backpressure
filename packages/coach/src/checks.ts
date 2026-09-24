// packages/coach/src/checks.ts
import type { Topology } from "@backpressure/concept-engine";

export interface StructuralFinding {
  id: string;
  passed: boolean;
  detail: string;
}

// A backend without a sibling is a single point of failure: its loss is
// a total outage. Distributors (lb, routers) are out of scope for this
// check; backend redundancy is the lesson.
export function noSinglePointOfFailure(topology: Topology): StructuralFinding {
  // A backend without a sibling is a single point of failure: its loss is
  // a total outage. Distributors (lb, routers) are out of scope for this
  // check; backend redundancy is the lesson.
  const backends = topology.nodes.filter((n) => n.kind === "service" || n.kind === "database");
  if (backends.length === 0) {
    return { id: "no_single_point_of_failure", passed: true, detail: "no backends to protect" };
  }
  const lonely = backends.filter((b) => !backends.some((other) => other.id !== b.id));
  if (lonely.length === 0) {
    return { id: "no_single_point_of_failure", passed: true, detail: "every backend has a surviving sibling" };
  }
  return {
    id: "no_single_point_of_failure",
    passed: false,
    detail: `backends without a sibling: ${lonely.map((b) => b.id).join(", ")}`,
  };
}

// Every database must sit behind a cache on some entry path.
export function cacheBetweenAppAndDb(topology: Topology): StructuralFinding {
  const databases = topology.nodes.filter((n) => n.kind === "database");
  if (databases.length === 0) {
    return { id: "cache_between_app_and_db", passed: true, detail: "no database nodes to shield" };
  }
  const cacheIds = new Set(topology.nodes.filter((n) => n.kind === "cache").map((n) => n.id));
  const ancestors = (target: string): Set<string> => {
    const seen = new Set<string>();
    const queue: string[] = [target];
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined || seen.has(current)) continue;
      seen.add(current);
      for (const edge of topology.edges) {
        if (edge.to === current) queue.push(edge.from);
      }
    }
    return seen;
  };
  const exposed = databases.filter((db) => ![...ancestors(db.id)].some((id) => cacheIds.has(id)));
  if (exposed.length === 0) {
    return { id: "cache_between_app_and_db", passed: true, detail: "every database sits behind a cache" };
  }
  return {
    id: "cache_between_app_and_db",
    passed: false,
    detail: `databases without a cache ancestor: ${exposed.map((db) => db.id).join(", ")}`,
  };
}

export const CHECKS: Record<string, (topology: Topology) => StructuralFinding> = {
  no_single_point_of_failure: noSinglePointOfFailure,
  cache_between_app_and_db: cacheBetweenAppAndDb,
};

export function runChecks(topology: Topology, ids: string[]): StructuralFinding[] {
  return ids.map((id) => {
    const check = CHECKS[id];
    if (check === undefined) throw new Error(`unknown structural check '${id}'`);
    return check(topology);
  });
}
