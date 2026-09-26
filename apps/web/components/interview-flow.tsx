// apps/web/components/interview-flow.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { GradeForm } from "./grade-form";
import type { GradeDimension, GradeReport, ScenarioDef } from "@backpressure/coach/grade-core";
import type { Topology } from "@backpressure/concept-engine";

export interface InterviewPhase {
  id: string;
  name: string;
  minutes: number;
}

export const PHASES: InterviewPhase[] = [
  { id: "requirements", name: "Requirements", minutes: 5 },
  { id: "estimation", name: "Estimation", minutes: 5 },
  { id: "api", name: "API and data model", minutes: 8 },
  { id: "design", name: "High-level design", minutes: 15 },
  { id: "deep-dive", name: "Deep dive", minutes: 12 },
];

interface TranscriptEntry {
  phase: string;
  payload: unknown;
  at: number;
}

function checkEstimation(
  qps: number,
  storageGb: number,
  bandwidthMbps: number,
  bands: { qps: [number, number]; storageGb: [number, number]; bandwidthMbps: [number, number] },
): string[] {
  const notes: string[] = [];
  if (!(qps >= bands.qps[0] && qps <= bands.qps[1])) notes.push(`Read QPS ${qps} looks off for these scale numbers: recheck posts/day times ratio.`);
  if (!(storageGb >= bands.storageGb[0] && storageGb <= bands.storageGb[1])) notes.push(`Storage ${storageGb}GB looks off: recheck bytes per record times retention.`);
  if (!(bandwidthMbps >= bands.bandwidthMbps[0] && bandwidthMbps <= bands.bandwidthMbps[1])) notes.push(`Bandwidth ${bandwidthMbps}Mbps looks off: check bytes times QPS arithmetic.`);
  return notes;
}

const DEEP_DIVE_PROBES: Record<string, string> = {
  availability: "Your weakest dimension is availability: which single failure hurts most, and what exactly survives it?",
  performance: "Your weakest dimension is performance: where does p99 go under 3x traffic, and what sheds first?",
  communication: "Strong numbers. Now defend them out loud: why this trade-off over the obvious alternative?",
};

export function InterviewFlow({
  slug,
  rubric,
  scenarios,
  estimationBands = { qps: [100, 20000], storageGb: [100, 10000], bandwidthMbps: [1, 1000] },
}: {
  slug: string;
  rubric: { dimensions: GradeDimension[] };
  scenarios: ScenarioDef[];
  estimationBands?: { qps: [number, number]; storageGb: [number, number]; bandwidthMbps: [number, number] };
}): JSX.Element {
  const [phaseIndex, setPhaseIndex] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(PHASES[0]?.minutes === undefined ? 300 : PHASES[0].minutes * 60);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [skippedAhead, setSkippedAhead] = useState<boolean>(false);
  const [requirements, setRequirements] = useState<string>("");
  const [qps, setQps] = useState<string>("1200");
  const [storageGb, setStorageGb] = useState<string>("1000");
  const [bandwidthMbps, setBandwidthMbps] = useState<string>("10");
  const [arithmetic, setArithmetic] = useState<string>("");
  const [apiText, setApiText] = useState<string>("");
  const [deepDiveAnswer, setDeepDiveAnswer] = useState<string>("");
  const [deepDiveDone, setDeepDiveDone] = useState<boolean>(false);
  const [report, setReport] = useState<GradeReport | null>(null);
  const [topology, setTopology] = useState<Topology | null>(null);
  const [coachState, setCoachState] = useState<{ summary: string; probes: { question: string; why: string }[] } | null>(null);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState<boolean>(false);

  const phase = PHASES[phaseIndex];
  if (phase === undefined) throw new Error("interview phase out of range");
  const phaseId: string = phase.id;

  useEffect(() => {
    setSecondsLeft(phase.minutes * 60);
  }, [phaseIndex, phase.minutes]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    try {
      window.localStorage.setItem(`bp:interview:${slug}`, JSON.stringify(transcript));
    } catch {
      // Private mode etc: transcript simply does not persist.
    }
  }, [transcript, slug]);

  function log(phaseId: string, payload: unknown): void {
    setTranscript((prev) => [...prev, { phase: phaseId, payload, at: Date.now() }]);
  }

  function next(): void {
    log(phaseId, { done: true });
    setPhaseIndex((i) => Math.min(i + 1, PHASES.length - 1));
  }

  function skipToDesign(): void {
    // Diving into architecture before requirements is allowed but flagged:
    // real loops penalise it, so the transcript records it.
    log(phaseId, { done: false, skippedAhead: true });
    setSkippedAhead(true);
    setPhaseIndex(3);
  }

  const estimationNotes = useMemo(
    () => checkEstimation(Number(qps) || 0, Number(storageGb) || 0, Number(bandwidthMbps) || 0, estimationBands),
    [qps, storageGb, bandwidthMbps, estimationBands],
  );

  const weakest = useMemo(() => {
    if (report === null) return null;
    const scored = report.dimensions.filter((d) => d.possible > 0);
    let worst: (typeof scored)[number] | null = null;
    for (const dimension of scored) {
      if (worst === null || dimension.earned / dimension.possible < worst.earned / worst.possible) {
        worst = dimension;
      }
    }
    return worst;
  }, [report]);

  async function askCoach(): Promise<void> {
    if (report === null || topology === null || weakest === null) return;
    setCoachLoading(true);
    setCoachError(null);
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          problem: slug,
          phase: "deep-dive",
          topology,
          weakness: weakest.id,
          structural: report.structural,
          verdicts: report.verdicts,
          transcript,
          attemptId: `local-${slug}`,
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
        "summary" in feedback &&
        "probes" in feedback &&
        typeof (feedback as { summary: unknown }).summary === "string" &&
        Array.isArray((feedback as { probes: unknown }).probes)
      ) {
        const probes = (feedback as { probes: unknown[] }).probes
          .filter(
            (probe): probe is { question: string; why: string } =>
              typeof probe === "object" &&
              probe !== null &&
              typeof (probe as { question: unknown }).question === "string" &&
              typeof (probe as { why: unknown }).why === "string",
          )
          .map((probe) => ({ question: probe.question, why: probe.why }));
        setCoachState({ summary: (feedback as { summary: string }).summary, probes });
      } else {
        setCoachError("coach returned an unshaped response");
      }
    } catch (error) {
      setCoachError(error instanceof Error ? error.message : String(error));
    } finally {
      setCoachLoading(false);
    }
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div>
      <section aria-label="Phase tracker" className="mt-8 border-t border-ink/20 pt-4">
        <ol className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm">
          {PHASES.map((p, i) => (
            <li key={p.id} className={i === phaseIndex ? "font-bold text-ember" : i < phaseIndex ? "" : "text-smoke"}>
              {i + 1} {p.name} ({p.minutes}m){i < phaseIndex ? " done" : ""}
            </li>
          ))}
        </ol>
        <p className="mt-2 font-mono text-sm" aria-live="polite">
          Time left in {phase.name}: {minutes}:{String(seconds).padStart(2, "0")}
          {secondsLeft === 0 ? " — time; move on when ready." : ""}
        </p>
        {skippedAhead && <p className="mt-1 text-sm text-ember">Skipped ahead early: flagged in your transcript.</p>}
        {phaseIndex < 3 && (
          <button type="button" className="mt-2 border border-ink px-3 py-1.5 text-sm" onClick={skipToDesign}>
            Skip to design (flagged in transcript)
          </button>
        )}
      </section>

      {phase.id === "requirements" && (
        <section aria-label="Requirements" className="mt-8 border-t border-ink/20 pt-4">
          <h2 className="text-xl font-bold">Requirements</h2>
          <p className="mt-3 max-w-2xl leading-relaxed">
            State functional, non-functional, and explicit out-of-scope before touching architecture.
          </p>
          <label className="mt-3 block max-w-2xl">
            Requirements
            <textarea
              className="mt-1 block w-full border border-ink/30 bg-paper p-2 text-sm"
              rows={6}
              value={requirements}
              onChange={(e) => setRequirements(e.currentTarget.value)}
            />
          </label>
          <button
            type="button"
            className="mt-3 border border-ember bg-ember px-3 py-1.5 text-paper disabled:opacity-50"
            disabled={requirements.trim().length === 0}
            onClick={() => {
              log("requirements", { requirements });
              next();
            }}
          >
            Commit requirements
          </button>
        </section>
      )}

      {phase.id === "estimation" && (
        <section aria-label="Estimation" className="mt-8 border-t border-ink/20 pt-4">
          <h2 className="text-xl font-bold">Estimation</h2>
          <p className="mt-3 max-w-2xl leading-relaxed">Show the arithmetic. Ranges accepted; hidden math is not.</p>
          <div className="mt-3 grid max-w-xl gap-3">
            <label className="block">
              Read QPS
              <input
                className="mt-1 block w-full border border-ink/30 bg-paper p-2 font-mono text-sm"
                value={qps}
                onChange={(e) => setQps(e.currentTarget.value)}
                inputMode="numeric"
              />
            </label>
            <label className="block">
              Storage (GB, 5 years)
              <input
                className="mt-1 block w-full border border-ink/30 bg-paper p-2 font-mono text-sm"
                value={storageGb}
                onChange={(e) => setStorageGb(e.currentTarget.value)}
                inputMode="numeric"
              />
            </label>
            <label className="block">
              Bandwidth (Mbps)
              <input
                className="mt-1 block w-full border border-ink/30 bg-paper p-2 font-mono text-sm"
                value={bandwidthMbps}
                onChange={(e) => setBandwidthMbps(e.currentTarget.value)}
                inputMode="numeric"
              />
            </label>
            <label className="block">
              Arithmetic (show it)
              <textarea
                className="mt-1 block w-full border border-ink/30 bg-paper p-2 text-sm"
                rows={4}
                value={arithmetic}
                onChange={(e) => setArithmetic(e.currentTarget.value)}
              />
            </label>
          </div>
          <ul className="mt-3 space-y-1 font-mono text-sm">
            {estimationNotes.map((note) => (
              <li key={note} className="text-ember">
                {note}
              </li>
            ))}
            {estimationNotes.length === 0 && <li>Ranges hold. Arithmetic shown. Good.</li>}
          </ul>
          <button
            type="button"
            className="mt-3 border border-ember bg-ember px-3 py-1.5 text-paper disabled:opacity-50"
            disabled={arithmetic.trim().length === 0}
            onClick={() => {
              log("estimation", { qps, storageGb, bandwidthMbps, arithmetic });
              next();
            }}
          >
            Commit estimation
          </button>
        </section>
      )}

      {phase.id === "api" && (
        <section aria-label="API and data model" className="mt-8 border-t border-ink/20 pt-4">
          <h2 className="text-xl font-bold">API and data model</h2>
          <p className="mt-3 max-w-2xl leading-relaxed">Endpoints, core entities, access patterns.</p>
          <label className="mt-3 block max-w-2xl">
            API and data model
            <textarea
              className="mt-1 block w-full border border-ink/30 bg-paper p-2 font-mono text-sm"
              rows={8}
              value={apiText}
              onChange={(e) => setApiText(e.currentTarget.value)}
            />
          </label>
          <button
            type="button"
            className="mt-3 border border-ember bg-ember px-3 py-1.5 text-paper disabled:opacity-50"
            disabled={apiText.trim().length === 0}
            onClick={() => {
              log("api", { apiText });
              next();
            }}
          >
            Commit API and data model
          </button>
        </section>
      )}

      {phase.id === "design" && (
        <section aria-label="High-level design" className="mt-8 border-t border-ink/20 pt-4">
          <h2 className="text-xl font-bold">High-level design (15 min: the canvas counts)</h2>
          <GradeForm
            rubric={rubric}
            scenarios={scenarios}
            onReport={(grade) => {
              setReport(grade);
              log("design", { total: grade.total });
            }}
            onTopology={(topo) => setTopology(topo)}
          />
          <button
            type="button"
            className="mt-3 border border-ink px-3 py-1.5 disabled:opacity-50"
            disabled={report === null}
            onClick={next}
          >
            Continue to deep dive
          </button>
        </section>
      )}

      {phase.id === "deep-dive" && (
        <section aria-label="Deep dive" className="mt-8 border-t border-ink/20 pt-4">
          <h2 className="text-xl font-bold">Deep dive</h2>
          {report === null || weakest === null || topology === null ? (
            <p className="mt-3">Grade a design first: the probe targets your weakest dimension.</p>
          ) : (
            <>
              <button
                type="button"
                className="mt-3 border border-ember bg-ember px-3 py-1.5 text-paper disabled:opacity-50"
                disabled={coachLoading}
                onClick={() => void askCoach()}
              >
                {coachLoading ? "Asking coach…" : "Ask coach for probes"}
              </button>
              {coachError !== null && <p className="mt-2 font-bold text-ember">{coachError}</p>}
              {coachState !== null && (
                <div className="mt-3 max-w-2xl">
                  <p className="leading-relaxed">{coachState.summary}</p>
                  <ul className="mt-2 space-y-2">
                    {coachState.probes.map((probe) => (
                      <li key={probe.question} className="border-b border-ink/10 pb-2">
                        {probe.question} <span className="text-sm text-smoke">({probe.why})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-3 max-w-2xl leading-relaxed">
                {DEEP_DIVE_PROBES[weakest.id] ?? "Defend your weakest dimension with numbers from your run."}
              </p>
              <label className="mt-3 block max-w-2xl">
                Answer
                <textarea
                  className="mt-1 block w-full border border-ink/30 bg-paper p-2 text-sm"
                  rows={6}
                  value={deepDiveAnswer}
                  onChange={(e) => setDeepDiveAnswer(e.currentTarget.value)}
                />
              </label>
              <button
                type="button"
                className="mt-3 border border-ember bg-ember px-3 py-1.5 text-paper disabled:opacity-50"
                disabled={deepDiveAnswer.trim().length === 0}
                onClick={() => {
                  log("deep-dive", { answer: deepDiveAnswer });
                  setDeepDiveDone(true);
                }}
              >
                Commit answer
              </button>
              {deepDiveDone && <p className="mt-2">Answer recorded in your transcript.</p>}
            </>
          )}
          <p className="mt-3 font-mono text-sm text-smoke">Transcript entries: {transcript.length}</p>
        </section>
      )}
    </div>
  );
}
