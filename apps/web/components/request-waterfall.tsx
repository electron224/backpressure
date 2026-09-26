// apps/web/components/request-waterfall.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RequestTrace } from "@backpressure/concept-engine";

const LANES = 12;
const DOT_R = 3;
const MAX_DOTS = 400;

interface PlacedDot {
  arrival: number;
  completeAt: number;
  latencyMs: number;
  ok: boolean;
  lane: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

export function RequestWaterfall({
  completions,
  durationMs,
  slo,
  label,
}: {
  completions: RequestTrace[];
  durationMs: number;
  slo: number;
  label: string;
}): JSX.Element {
  const dots = useMemo<PlacedDot[]>(() => {
    const stride = Math.max(1, Math.ceil(completions.length / MAX_DOTS));
    const placed: PlacedDot[] = [];
    completions.forEach((completion, i) => {
      if (i % stride !== 0) return;
      placed.push({
        arrival: Math.max(0, completion.at - completion.latencyMs),
        completeAt: completion.at,
        latencyMs: completion.latencyMs,
        ok: completion.ok,
        lane: placed.length % LANES,
      });
    });
    return placed;
  }, [completions]);

  const windowEnd = useMemo(
    () => Math.max(durationMs, ...dots.map((d) => d.completeAt), 1),
    [dots, durationMs],
  );
  const [now, setNow] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(4);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlaying(false);
      setNow(windowEnd);
    }
  }, [windowEnd]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (stamp: number): void => {
      const elapsed = stamp - last;
      last = stamp;
      setNow((current) => {
        const next = current + elapsed * speed;
        if (next >= windowEnd) {
          setPlaying(false);
          return windowEnd;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, speed, windowEnd]);

  useEffect(() => {
    setNow(0);
    setPlaying(true);
  }, [completions, durationMs]);

  const width = 560;
  const height = 150;
  const laneH = height / LANES;
  const landed = dots.filter((d) => d.completeAt <= now);
  const latencies = landed.filter((d) => d.ok).map((d) => d.latencyMs).sort((a, b) => a - b);
  const errors = landed.filter((d) => !d.ok).length;
  const visible = dots.filter((d) => d.arrival <= now && d.completeAt > now - windowEnd * 0.05);

  function restart(): void {
    setNow(0);
    setPlaying(true);
  }

  return (
    <figure className="mt-4 border border-ink/20" aria-label={label}>
      <figcaption className="flex flex-wrap gap-x-5 px-3 py-2 font-mono text-sm">
        <span className="text-smoke">{label}</span>
        <span aria-live="off">
          t={Math.round(now)}ms served={landed.filter((d) => d.ok).length} errors={errors} p99=
          {Math.round(percentile(latencies, 99))}ms
        </span>
        {dots.length < completions.length && <span className="text-smoke">showing {dots.length} of {completions.length}</span>}
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height + 8}`} className="block w-full" role="img" aria-label={`${label} animation`}>
        {visible.map((dot, i) => {
          const span = Math.max(1, dot.completeAt - dot.arrival);
          const progress = Math.min(1, Math.max(0, (now - dot.arrival) / span));
          const x = Math.round(progress * width);
          const y = Math.round(dot.lane * laneH + laneH / 2);
          const slow = dot.ok && dot.latencyMs > slo;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={slow ? DOT_R + 1.5 : DOT_R}
              fill={dot.ok ? (slow ? "#B03A2E" : "#1C2530") : "none"}
              stroke={dot.ok ? "none" : "#B03A2E"}
              strokeWidth={dot.ok ? 0 : 1.5}
              opacity={progress >= 1 ? 0.35 : 1}
            />
          );
        })}
        <line x1={0} y1={height + 4} x2={width} y2={height + 4} stroke="#1C2530" strokeOpacity={0.2} strokeWidth={1} />
      </svg>
      <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 px-3 py-2">
        <button
          type="button"
          className="border border-ink px-3 py-1.5 text-sm"
          onClick={() => {
            if (!playing && now >= windowEnd) restart();
            else setPlaying((p) => !p);
          }}
        >
          {playing ? "Pause" : now >= windowEnd ? "Replay" : "Play"}
        </button>
        <button type="button" className="border border-ink px-3 py-1.5 text-sm" onClick={restart}>
          Restart
        </button>
        <label className="font-mono text-sm">
          Speed
          <select
            className="ml-2 border border-ink/30 bg-paper px-2 py-1"
            value={speed}
            onChange={(e) => setSpeed(Number(e.currentTarget.value))}
          >
            {[1, 4, 16].map((option) => (
              <option key={option} value={option}>
                {option}x
              </option>
            ))}
          </select>
        </label>
        <span className="font-mono text-xs text-smoke">ink: fast · large ember: slow · ring: failed</span>
      </div>
    </figure>
  );
}
