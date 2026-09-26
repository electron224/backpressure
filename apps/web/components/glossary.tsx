// apps/web/components/glossary.tsx

const TERMS: { term: string; definition: string }[] = [
  { term: "RPS", definition: "Requests per second: how much traffic arrives. The slider sets it." },
  { term: "Latency", definition: "How long one request takes, in milliseconds. Lower is faster." },
  { term: "p50", definition: "The middle request's latency. Half faster, half slower." },
  {
    term: "p99",
    definition: "The slowest 1%'s latency. If p99 is 2000ms, 1 in 100 users waits 2 seconds. Averages hide these; p99 does not.",
  },
  { term: "Throughput", definition: "Requests completed per second. Caps at what the system can serve." },
  { term: "Errors", definition: "Rejected or failed requests (429s, 503s). Counted, never timed." },
  { term: "Queue depth", definition: "Requests waiting for a free slot. Watch it first: it moves before latency and errors do." },
  { term: "SLO", definition: "The promise line (here: p99 under 150ms). Cross it and the verdict reads FAIL." },
  { term: "Verdict", definition: "The simulator's machine-checked pass/fail on one goal. A measurement, not an opinion." },
];

export function Glossary(): JSX.Element {
  return (
    <details className="mt-4 border border-ink/20 px-3 py-2">
      <summary className="cursor-pointer font-mono text-sm hover:text-ember">
        Terms used on this page (RPS, p99, SLO…)
      </summary>
      <dl className="mt-2 space-y-1 text-sm">
        {TERMS.map((entry) => (
          <div key={entry.term}>
            <dt className="inline font-bold">{entry.term}: </dt>
            <dd className="inline">{entry.definition}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-smoke">
        How to solve anything here: read the numbers, guess the cause, change one control, re-run, check the
        verdict.
      </p>
    </details>
  );
}
