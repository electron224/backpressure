// packages/concept-engine/src/predict.ts
export const DEFAULT_PREDICTION_TOLERANCE_MS = 50;

export function predictionError(predictedMs: number, actualMs: number): number {
  return Math.abs(predictedMs - actualMs);
}

export function gradePrediction(errorMs: number, toleranceMs: number = DEFAULT_PREDICTION_TOLERANCE_MS): boolean {
  if (!(toleranceMs >= 0)) {
    throw new Error(`tolerance must be >= 0, got ${toleranceMs}`);
  }
  return errorMs <= toleranceMs;
}
