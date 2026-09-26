// apps/web/components/coach-lab.tsx
"use client";

import { useState } from "react";
import { compileFlow } from "@backpressure/canvas";
import { runPreset } from "@backpressure/concept-engine";
import type { Topology } from "@backpressure/concept-engine";
import { runChecks } from "@backpressure/coach/checks";
import { CanvasEditor } from "./canvas-editor";
import type { EditorGraph } from "./canvas-editor";
import { MetricTable } from "./metric-table";
import { MetricChart } from "./metric-chart";

interface CoachProbe {
  question: string;
  why: string;
}

const STARTER: EditorGraph = {
  nodes: [
    { id: "lb", kind: "lb" },
    { id: "web-a", kind: "service" },
    { id: "web-b", kind: "service" },
  ],
  edges: [
    { from: "lb", to: "web-a" },
    { from: "lb", to: "web-b" },
  ],
};

export function CoachLab(): JSX.Element {
  const [graph, setGraph] = useState<EditorGraph>(STARTER);
  const [rps, setRps] = useState<number>(100);
  const [ran, setRan] = useState<{ p99: number; verdict: "PASS" | "FAIL"; narration: string; series: { t: number; p99: number; throughput: number; errors: number }[] } | null>(null);
  const [topology, setTopology] = useState<Topology | null>(null);
  const [coach, setCoach] = useState<{ summary: string; probes: CoachProbe[] } | null>(null);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  function run(): void {
    try {
      const compiled = compileFlow(
        graph.nodes.map((node) => ({ id: node.id, kind: node.kind, config: {} })),
        graph.edges,
      );
      const preset = {
        id: "coach-critique",
        topology: compiled,
        controls: [],
        metrics: ["p99"],
        challenges: [{ id: "coach.run", text: "Run for critique", verdict: "slo.p99" }],
      };
      const result = runPreset(preset, { rps });
      setRan({ p99: result.p99, verdict: result.verdict, narration: result.narration, series: result.series });
      setTopology(compiled);
      setCoach(null);
      setCoachError(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function askCoach(): Promise<void> {
    if (ran === null || topology === null) return;
    setLoading(true);
    setCoachError(null);
    try {
      const structural = runChecks(topology, ["no_single_point_of_failure", "cache_between_app_and_db"]);
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          problem: "open-critique",
          phase: "critique",
          topology,
          weakness: structural.every((finding) => finding.passed) ? "performance" : "availability",
          structural,
          verdicts: [{ id: "slo.p99", passed: ran.verdict === "PASS", observed: Math.round(ran.p99) }],
          transcript: [],
          attemptId: "coach-page",
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        setCoachError(typeof body === "object" && body !== null && "error" in body ? String((body as { error: unknown }).error) : "coach request failed");
        return;
      }
      const feedback: unknown = (body as { feedback?: unknown }).feedback;
      if (
        typeof feedback === "object" &&
        feedback !== null &&
        typeof (feedback as { summary?: unknown }).summary === "string" &&
        Array.isArray((feedback as { probes?: unknown }).probes)
      ) {
        const summary = (feedback as { summary: string }).summary;
        const probes = ((feedback as { probes: unknown[] }).probes as unknown[])
          .filter(
            (probe): probe is CoachProbe =>
              typeof probe === "object" &&
              probe !== null &&
              typeof (probe as { question: unknown }).question === "string" &&
              typeof (probe as { why: unknown }).why === "string",
          )
          .map((probe) => ({ question: probe.question, why: probe.why }));
        setCoach({ summary, probes });
      } else {
        setCoachError("coach returned an unshaped response");
      }
    } catch (error) {
      setCoachError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <section aria-label="Topology" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">
          <span className="mr-3 font-mono text-sm font-normal text-smoke">01</span>Draw a design
        </h2>
        <div className="mt-3">
          <CanvasEditor initial={STARTER} onChange={setGraph} />
        </div>
        <label className="mt-3 block max-w-xl">
          Traffic (RPS): {rps}
          <input
            className="block w-full"
            type="range"
            min={10}
            max={300}
            value={rps}
            onChange={(e) => setRps(Number(e.currentTarget.value))}
          />
        </label>
        <button type="button" className="mt-3 border border-ember bg-ember px-3 py-1.5 min-h-[44px] text-paper" onClick={run}>
          Run design
        </button>
      </section>
      {error !== null && <p className="mt-3 font-bold text-ember">{error}</p>}
      {ran !== null && (
        <>
          <section aria-label="Results" className="mt-8 border-t border-ink/20 pt-4">
            <h2 className="text-xl font-bold">
              <span className="mr-3 font-mono text-sm font-normal text-smoke">02</span>What the numbers say
            </h2>
            <MetricTable rows={[{ strategy: "design", p99: ran.p99, verdict: ran.verdict, narration: ran.narration }]} />
            <MetricChart series={ran.series} slo={150} label="p99 over time: design" />
          </section>
          <section aria-label="Coach" className="mt-8 border-t border-ink/20 pt-4">
            <h2 className="text-xl font-bold">
              <span className="mr-3 font-mono text-sm font-normal text-smoke">03</span>Ask the coach
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed">
              Grounded in the numbers above — never a score. Needs a provider key, otherwise honest fallback.
            </p>
            <button
              type="button"
              className="mt-3 border border-ember bg-ember px-3 py-1.5 text-paper disabled:opacity-50"
              disabled={loading}
              onClick={() => void askCoach()}
            >
              {loading ? "Asking coach…" : "Critique my design"}
            </button>
            {coachError !== null && <p className="mt-2 font-bold text-ember">{coachError}</p>}
            {coach !== null && (
              <div className="mt-3 max-w-2xl">
                <p className="leading-relaxed">{coach.summary}</p>
                <ul className="mt-2 space-y-2">
                  {coach.probes.map((probe) => (
                    <li key={probe.question} className="border-b border-ink/10 pb-2">
                      {probe.question} <span className="text-sm text-smoke">({probe.why})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
