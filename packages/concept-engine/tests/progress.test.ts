// packages/concept-engine/tests/progress.test.ts
import { describe, expect, it } from "vitest";
import { createProgress } from "../src/progress.js";
import type { StorageLike } from "../src/progress.js";

function memoryStore(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}

describe("createProgress", () => {
  it("round-trips stages and predictions", () => {
    const progress = createProgress(memoryStore());
    progress.completeStage("load-balancing", "play");
    progress.logPrediction("load-balancing", { predicted: 100, actual: 146, error: 46 });
    const state = progress.get("load-balancing");
    expect(state.stages).toContain("play");
    expect(state.predictions).toEqual([{ predicted: 100, actual: 146, error: 46 }]);
  });

  it("does not duplicate a completed stage", () => {
    const progress = createProgress(memoryStore());
    progress.completeStage("load-balancing", "play");
    progress.completeStage("load-balancing", "play");
    expect(progress.get("load-balancing").stages).toEqual(["play"]);
  });

  it("recovers from corrupt JSON instead of throwing", () => {
    const store = memoryStore();
    store.setItem("bp:load-balancing", "{broken");
    const progress = createProgress(store);
    expect(() => progress.get("load-balancing")).not.toThrow();
    expect(progress.get("load-balancing")).toEqual({ stages: [], predictions: [] });
  });
});
