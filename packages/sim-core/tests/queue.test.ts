// packages/sim-core/tests/queue.test.ts
import { describe, expect, it } from "vitest";
import { EventQueue } from "../src/queue.js";

describe("EventQueue", () => {
  it("pops in time order with seq tiebreak", () => {
    const q = new EventQueue();
    q.push(10, "a", "n1");
    q.push(5, "b", "n2");
    q.push(5, "c", "n3");
    expect(q.pop()?.kind).toBe("b");
    expect(q.pop()?.kind).toBe("c");
    expect(q.pop()?.kind).toBe("a");
    expect(q.isEmpty()).toBe(true);
  });
});
