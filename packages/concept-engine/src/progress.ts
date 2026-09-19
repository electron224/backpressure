// packages/concept-engine/src/progress.ts
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PredictionRecord {
  predicted: number;
  actual: number;
  error: number;
}

export interface ConceptProgress {
  stages: string[];
  predictions: PredictionRecord[];
}

function keyFor(slug: string): string {
  return `bp:${slug}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isPredictionRecord(value: unknown): value is PredictionRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value["predicted"] === "number" &&
    typeof value["actual"] === "number" &&
    typeof value["error"] === "number"
  );
}

export function createProgress(store: StorageLike): {
  completeStage: (slug: string, stage: string) => void;
  logPrediction: (slug: string, record: PredictionRecord) => void;
  get: (slug: string) => ConceptProgress;
} {
  function get(slug: string): ConceptProgress {
    const raw = store.getItem(keyFor(slug));
    if (raw === null) return { stages: [], predictions: [] };
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return { stages: [], predictions: [] };
      const stagesRaw: unknown = parsed["stages"];
      const predictionsRaw: unknown = parsed["predictions"];
      const stages: string[] = Array.isArray(stagesRaw) ? stagesRaw.filter(isString) : [];
      const predictions: PredictionRecord[] = Array.isArray(predictionsRaw)
        ? predictionsRaw.filter(isPredictionRecord)
        : [];
      return { stages, predictions };
    } catch {
      store.removeItem(keyFor(slug));
      return { stages: [], predictions: [] };
    }
  }

  function put(slug: string, state: ConceptProgress): void {
    store.setItem(keyFor(slug), JSON.stringify(state));
  }

  function completeStage(slug: string, stage: string): void {
    const state = get(slug);
    if (!state.stages.includes(stage)) {
      put(slug, { ...state, stages: [...state.stages, stage] });
    }
  }

  function logPrediction(slug: string, record: PredictionRecord): void {
    const state = get(slug);
    put(slug, { ...state, predictions: [...state.predictions, record] });
  }

  return { completeStage, logPrediction, get };
}
