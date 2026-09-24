// packages/sim-components/tests/load-balancer-breaker.test.ts
import { describe, expect, it } from "vitest";
import { createLoadBalancer } from "../src/load-balancer.js";

const noLoad = (): number => 0;
const breaker = { failureThreshold: 3, cooldownMs: 2000 };

describe("circuit breaker", () => {
  it("stays closed below threshold", () => {
    const lb = createLoadBalancer({ strategy: "round-robin", backends: ["a", "b"], breaker });
    lb.recordResult("a", false, 0);
    lb.recordResult("a", false, 10);
    expect(lb.pick(noLoad, 20)).toBe("a");
  });

  it("opens at threshold and skips the backend", () => {
    const lb = createLoadBalancer({ strategy: "round-robin", backends: ["a", "b"], breaker });
    lb.recordResult("b", false, 0);
    lb.recordResult("b", false, 10);
    lb.recordResult("b", false, 20);
    expect(lb.pick(noLoad, 30)).toBe("a");
    expect(lb.narrate()).toContain("open=[b]");
  });

  it("half-open trial closes on success", () => {
    const lb = createLoadBalancer({ strategy: "round-robin", backends: ["a", "b"], breaker });
    lb.recordResult("b", false, 0);
    lb.recordResult("b", false, 10);
    lb.recordResult("b", false, 20);
    expect(lb.pick(noLoad, 2030)).toBe("b");
    lb.recordResult("b", true, 2030);
    expect(lb.pick(noLoad, 2040)).toBe("a");
    expect(lb.narrate()).not.toContain("open=[b]");
  });

  it("half-open trial failure re-opens", () => {
    const lb = createLoadBalancer({ strategy: "round-robin", backends: ["a", "b"], breaker });
    for (const at of [0, 10, 20]) lb.recordResult("b", false, at);
    lb.pick(noLoad, 2030);
    lb.recordResult("b", false, 2030);
    expect(lb.pick(noLoad, 2040)).toBe("a");
    expect(lb.narrate()).toContain("open=[b]");
  });

  it("success resets the streak", () => {
    const lb = createLoadBalancer({ strategy: "round-robin", backends: ["a", "b"], breaker });
    lb.recordResult("a", false, 0);
    lb.recordResult("a", false, 10);
    lb.recordResult("a", true, 20);
    lb.recordResult("a", false, 30);
    lb.recordResult("a", false, 40);
    expect(lb.pick(noLoad, 50)).toBe("a");
  });

  it("falls back to first when all open", () => {
    const lb = createLoadBalancer({ strategy: "round-robin", backends: ["a", "b"], breaker });
    for (const id of ["a", "b"]) for (const at of [0, 10, 20]) lb.recordResult(id, false, at);
    expect(lb.pick(noLoad, 30)).toBe("a");
  });

  it("recordResult on unknown backend throws", () => {
    const lb = createLoadBalancer({ strategy: "round-robin", backends: ["a"], breaker });
    expect(() => lb.recordResult("ghost", false, 0)).toThrow(/unknown backend/i);
  });

  it("rejects bad breaker opts", () => {
    expect(() => createLoadBalancer({ strategy: "round-robin", backends: ["a"], breaker: { failureThreshold: 0, cooldownMs: 2000 } })).toThrow();
    expect(() => createLoadBalancer({ strategy: "round-robin", backends: ["a"], breaker: { failureThreshold: 3, cooldownMs: -1 } })).toThrow();
  });
});

describe("weighted shares", () => {
  it("splits 9:1 across ten picks", () => {
    const lb = createLoadBalancer({
      strategy: "round-robin",
      backends: ["v1", "v2"],
      weights: [
        { id: "v1", weight: 9 },
        { id: "v2", weight: 1 },
      ],
    });
    const counts = new Map<string, number>();
    for (let i = 0; i < 100; i += 1) {
      const pick = lb.pick(() => 0, i);
      counts.set(pick, (counts.get(pick) ?? 0) + 1);
    }
    expect(counts.get("v1")).toBe(90);
    expect(counts.get("v2")).toBe(10);
  });

  it("skips open backends inside the cycle", () => {
    const lb = createLoadBalancer({
      strategy: "round-robin",
      backends: ["v1", "v2"],
      breaker: { failureThreshold: 1, cooldownMs: 60_000 },
      weights: [
        { id: "v1", weight: 1 },
        { id: "v2", weight: 1 },
      ],
    });
    lb.recordResult("v2", false, 0);
    expect(lb.pick(() => 0, 10)).toBe("v1");
  });

  it("rejects unknown backends and zero sums", () => {
    expect(() =>
      createLoadBalancer({ strategy: "round-robin", backends: ["v1"], weights: [{ id: "ghost", weight: 1 }] }),
    ).toThrow(/unknown backend/i);
    expect(() =>
      createLoadBalancer({
        strategy: "round-robin",
        backends: ["v1"],
        weights: [{ id: "v1", weight: 0 }],
      }),
    ).toThrow(/zero/i);
  });
});
