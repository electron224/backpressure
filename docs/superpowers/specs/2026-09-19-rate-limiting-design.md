# Rate Limiting — Design

Date: 2026-09-19
Status: approved
Scope: Token-bucket + sliding-window-counter limiter component, interpreter/schema support, rate-limiting concept. First Tier-2 slice.

## Goal
`/concepts/rate-limiting` shows shaping vs bursting: token bucket sheds excess at sustained overload while the service stays clean, and sliding-window-counter admits ~2× across a window edge (boundary burst). Learner watches 429s, not latency, as the signal.

## Non-goals
Leaky-bucket code path (Learn prose mirror), per-key limiting (needs engine key distribution — Tier 3), distributed/global limits (prose), canvas renderer (M2), styling.

## Component: createRateLimiter
`createRateLimiter(id, { algorithm: "token-bucket" | "sliding-window", rps: number, burst: number })` + downstream wiring via topology edges (single downstream; >1 throws).
- Token-bucket: fractional tokens, continuous refill at rps/sec, capacity burst. Consume 1 or reject.
- Sliding-window-counter: fixed 1s windows from t=0 (virtual time), cap rps per window. Boundary burst emerges, not special-cased.
- Allowed: forward with arrival preserved. Rejected: `ctx.complete(now, 0, false)` (429 in errors series).
- No RNG, virtual-time only (`ctx.now`). `metrics()` → `{ allowed, rejected }`.
- `narrate()` → `"limiter(<algo> <rps>rps/burst <burst>): allowed=N rejected=M"`.

## Preset (client → limiter → service 20ms/c4)
Default limit 100/burst 20, traffic slider 20–300 def 80. At 80 token-bucket ~zero rejects; at 150 sustained 429s with service drops at 0. Algorithm select flips shaping; chaos traffic-spike across a window edge demonstrates the ~2× admit on sliding-window.
Challenges: `rl.1` hold 150 RPS with zero service drops (verdict slo.p99 PASS behind the limiter); `rl.2` raise burst 20→100 at 150 RPS and watch rejected fall (burst-tolerance, pinned in-test). The sliding-window boundary burst is Learn math + a handler-level unit pin (100 admits at t=999 and 100 at t=1000); a UI-driven adversarial burst needs scripted arrival patterns the engine lacks — recorded follow-up, not lab fiction.

## Interpreter + schema (only infra)
- `TopologyNodeSchema` kind += `"rate-limiter"`.
- `runPreset`: chain-node handling (forward to single edge target; kill → dropBackend all-down narration path already exists).
- Controls need nothing new (select/slider + `nodeId.field` overrides cover algorithm/rps/burst).
- Chaos union picks up limiter ids automatically.
- Canvas renderer deferred to M2.

## Testing
- Determinism (seed ×2 identical; locks RNG-free design).
- Token-bucket: 20-instant burst absorbed at burst 20, 21st rejects; refill over virtual time.
- Sliding-window: per-window cap; boundary double-admit pinned.
- Integration: service drops stay 0 at 150 RPS behind limiter.
- Content validation + ≤600w tests (Tier-1 pattern).

## Content
Learn ≤600w (protect-origin why, per-key-vs-global interview line, leaky prose mirror). Recall 3–4. Preset + content only in web (no island/page changes).

## Self-review
- No TBDs. Burst numbers derive from stated configs (bucket 20, windows 1s).
- Consistent with AGENTS.md §5 component contract (minus canvas renderer, deferred with reason), §6 four stages, §8 chaos/predict.
- Single-plan scope: one component + one concept.
