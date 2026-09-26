// packages/coach/src/checks.ts
import type { LabPreset, Topology } from "@backpressure/concept-engine";
import { runPreset } from "@backpressure/concept-engine";

export interface StructuralFinding {
  id: string;
  passed: boolean;
  detail: string;
  observed?: number;
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

export interface CheckContext {
  rps: number;
  writePct?: number;
  sloP99Ms: number;
}

function asPreset(topology: Topology, sloP99Ms: number): LabPreset {
  return {
    id: "check",
    topology,
    controls: [],
    metrics: ["p99"],
    challenges: [{ id: "check.run", text: "Check the topology", verdict: "slo.p99" }],
    sloP99Ms,
  };
}

function needCtx(ctx: CheckContext | undefined, id: string): CheckContext {
  if (ctx === undefined) throw new Error(`check '${id}' needs an rps/slo context`);
  return ctx;
}

export function sloP99UnderLoad(topology: Topology, ctx?: CheckContext): StructuralFinding {
  const context = needCtx(ctx, "slo_p99_under_load");
  const result = runPreset(asPreset(topology, context.sloP99Ms), {
    rps: context.rps,
    writePct: context.writePct ?? 0,
  });
  return {
    id: "slo_p99_under_load",
    passed: result.verdict === "PASS",
    detail: `p99 ${Math.round(result.p99)}ms vs SLO ${context.sloP99Ms}ms at ${context.rps} RPS`,
    observed: Math.round(result.p99),
  };
}

export function survivesEachSingleLoss(topology: Topology, ctx?: CheckContext): StructuralFinding {
  const context = needCtx(ctx, "survives_each_single_loss");
  const ids = topology.nodes.filter((n) => n.kind === "service" || n.kind === "database").map((n) => n.id);
  let survived = 0;
  for (const id of ids) {
    const result = runPreset(
      asPreset(topology, context.sloP99Ms),
      { rps: context.rps, writePct: context.writePct ?? 0 },
      { dropBackend: id },
    );
    if (result.verdict === "PASS") survived += 1;
  }
  return {
    id: "survives_each_single_loss",
    passed: ids.length > 0 && survived === ids.length,
    detail: `survived ${survived}/${ids.length} single-backend losses`,
  };
}

export interface CheckScenario {
  id: string;
  rps: number;
  writePct?: number;
  sloP99Ms: number;
  eachBackend?: boolean;
}

export interface GradeVerdict {
  id: string;
  passed: boolean;
  observed: number;
}

export interface CriterionEvaluation {
  finding: StructuralFinding;
  verdicts: GradeVerdict[];
  credit: number;
}

function backendIds(topology: Topology): string[] {
  return topology.nodes.filter((n) => n.kind === "service" || n.kind === "database").map((n) => n.id);
}

export function evaluateCriterion(
  topology: Topology,
  checkId: string,
  scenarios: CheckScenario[],
): CriterionEvaluation {
  if (checkId === "no_single_point_of_failure" || checkId === "cache_between_app_and_db") {
    const [finding] = runChecks(topology, [checkId]);
    if (finding === undefined) throw new Error(`check produced no finding: ${checkId}`);
    return { finding, verdicts: [], credit: finding.passed ? 1 : 0 };
  }
  if (checkId === "slo_p99_under_load") {
    const baseline = scenarios.find((s) => s.id === "baseline") ?? scenarios[0];
    if (baseline === undefined) throw new Error("slo_p99_under_load needs at least one scenario");
    const [finding] = runChecks(topology, [checkId], {
      rps: baseline.rps,
      sloP99Ms: baseline.sloP99Ms,
      ...(baseline.writePct === undefined ? {} : { writePct: baseline.writePct }),
    });
    if (finding === undefined) throw new Error(`check produced no finding: ${checkId}`);
    const verdicts: GradeVerdict[] =
      finding.observed === undefined
        ? []
        : [{ id: "slo.p99:baseline", passed: finding.passed, observed: finding.observed }];
    return { finding, verdicts, credit: finding.passed ? 1 : 0 };
  }
  if (checkId === "survives_each_single_loss") {
    const loss = scenarios.find((s) => s.eachBackend === true) ?? scenarios.find((s) => s.id === "baseline") ?? scenarios[0];
    if (loss === undefined) throw new Error("survives_each_single_loss needs at least one scenario");
    const [finding] = runChecks(topology, [checkId], {
      rps: loss.rps,
      sloP99Ms: loss.sloP99Ms,
      ...(loss.writePct === undefined ? {} : { writePct: loss.writePct }),
    });
    if (finding === undefined) throw new Error(`check produced no finding: ${checkId}`);
    const ids = backendIds(topology);
    const verdicts: GradeVerdict[] = [];
    for (const id of ids) {
      const result = runPreset(
        asPreset(topology, loss.sloP99Ms),
        { rps: loss.rps, writePct: loss.writePct ?? 0 },
        { dropBackend: id },
      );
      verdicts.push({ id: `slo.p99:loss-${id}`, passed: result.verdict === "PASS", observed: Math.round(result.p99) });
    }
    const survived = verdicts.filter((v) => v.passed).length;
    return { finding, verdicts, credit: ids.length === 0 ? 0 : survived / ids.length };
  }
  throw new Error(`unknown check '${checkId}' (register it in packages/coach/src/checks.ts)`);
}

export const CHECKS: Record<string, (topology: Topology, ctx?: CheckContext) => StructuralFinding> = {
  no_single_point_of_failure: noSinglePointOfFailure,
  cache_between_app_and_db: cacheBetweenAppAndDb,
  slo_p99_under_load: sloP99UnderLoad,
  survives_each_single_loss: survivesEachSingleLoss,
};

export function runChecks(topology: Topology, ids: string[], ctx?: CheckContext): StructuralFinding[] {
  return ids.map((id) => {
    const check = CHECKS[id];
    if (check === undefined) throw new Error(`unknown structural check '${id}'`);
    return check(topology, ctx);
  });
}
