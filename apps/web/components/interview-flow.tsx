// apps/web/components/interview-flow.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { GradeForm } from "./grade-form";
import type { GradeDimension, GradeReport, ScenarioDef } from "@backpressure/coach/grade-core";

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

// Estimation accept bands derived from scale.json (order-of-magnitude
// tolerance): 10M DAU, 1M writes/day.
function checkEstimation(qps: number, storageGb: number, bandwidthMbps: number): string[] {
  const notes: string[] = [];
  if (!(qps >= 100 && qps <= 20000)) notes.push(`Read QPS ${qps} looks off: ~1.2k expected from 1M writes/day at 100:1.`);
  if (!(storageGb >= 100 && storageGb <= 10000)) notes.push(`Storage ${storageGb}GB looks off: ~1TB for 5 years at ~530B per URL.`);
  if (!(bandwidthMbps >= 1 && bandwidthMbps <= 1000)) notes.push(`Bandwidth ${bandwidthMbps}Mbps looks off: check bytes × QPS arithmetic.`);
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
}: {
  slug: string;
  rubric: { dimensions: GradeDimension[] };
  scenarios: ScenarioDef[];
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
    () => checkEstimation(Number(qps) || 0, Number(storageGb) || 0, Number(bandwidthMbps) || 0),
    [qps, storageGb, bandwidthMbps],
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
          {report === null || weakest === null ? (
            <p className="mt-3">Grade a design first: the probe targets your weakest dimension.</p>
          ) : (
            <>
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
