// apps/web/lib/tracks.ts
// The guided path: tiers in build order, slugs as they exist in content/.
// cache-invalidation-and-stampede is folded into cdn + caching-strategies
// (see final report notes), so Tier 3 lists seven.

export interface Track {
  id: string;
  title: string;
  blurb: string;
  slugs: string[];
}

export const TRACKS: Track[] = [
  {
    id: "tier-1",
    title: "Tier 1: Fundamentals",
    blurb: "Start here. Five ideas everything else assumes.",
    slugs: [
      "latency-and-throughput",
      "back-of-envelope-estimation",
      "vertical-vs-horizontal-scaling",
      "statelessness",
      "single-point-of-failure",
    ],
  },
  {
    id: "tier-2",
    title: "Tier 2: Traffic layer",
    blurb: "What sits between users and your code.",
    slugs: [
      "load-balancing",
      "reverse-proxy-vs-api-gateway",
      "cdn",
      "rate-limiting",
      "health-checks-and-circuit-breakers",
    ],
  },
  {
    id: "tier-3",
    title: "Tier 3: Data layer",
    blurb: "Where state lives and how it scales.",
    slugs: [
      "caching-strategies",
      "eviction-policies",
      "sql-vs-nosql",
      "indexing",
      "replication",
      "sharding",
      "consistent-hashing",
    ],
  },
  {
    id: "tier-4",
    title: "Tier 4: Distributed systems theory",
    blurb: "The trade-offs interviewers probe.",
    slugs: [
      "cap-theorem",
      "pacelc",
      "consistency-models",
      "quorums-and-n-r-w",
      "idempotency-and-exactly-once",
      "distributed-transactions-and-saga",
      "leader-election-intuition",
    ],
  },
  {
    id: "tier-5",
    title: "Tier 5: Async and delivery",
    blurb: "Queues, streams, and what happens between services.",
    slugs: [
      "message-queues-vs-streams",
      "pub-sub",
      "backpressure-and-dlq",
      "fan-out-on-write-vs-read",
      "cdc-and-outbox",
    ],
  },
  {
    id: "tier-6",
    title: "Tier 6: Operability",
    blurb: "Running it in production without paging yourself.",
    slugs: [
      "observability-golden-signals",
      "slo-error-budgets",
      "graceful-degradation-and-bulkheads",
      "deployment-strategies",
      "capacity-and-cost-modelling",
    ],
  },
];

export function nextAfter(slug: string): { track: Track; slug: string } | null {
  for (const track of TRACKS) {
    const index = track.slugs.indexOf(slug);
    if (index !== -1) {
      const next = track.slugs[index + 1];
      if (next !== undefined) return { track, slug: next };
      const trackIndex = TRACKS.indexOf(track);
      const following = TRACKS[trackIndex + 1];
      const first = following?.slugs[0];
      if (following !== undefined && first !== undefined) return { track: following, slug: first };
      return null;
    }
  }
  return null;
}

export function prerequisitesFor(slug: string): string[] {
  const all: string[] = [];
  for (const track of TRACKS) {
    for (const candidate of track.slugs) {
      if (candidate === slug) return all;
      all.push(candidate);
    }
  }
  return all;
}
