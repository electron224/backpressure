// packages/scheduler/src/fsrs.ts
// FSRS-4.5 short-term core with published default weights. Stability (S),
// difficulty (D), and retrievability (R) follow the reference equations;
// weights are fittable per user in a later slice (defaults ship now).
// Grades: 1 Again, 2 Hard, 3 Good, 4 Easy.

export const DEFAULT_WEIGHTS = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
  0.0614, 0.2629, 1.6483, 0.6014, 1.8729,
];

export const DECAY = -0.5;
export const FACTOR = 19 / 81;
export const DESIRED_RETENTION = 0.9;

export type Grade = 1 | 2 | 3 | 4;

export interface CardState {
  stability: number;
  difficulty: number;
  dueDay: number;
  lastReviewDay: number;
}

export function initStability(grade: Grade, w: number[] = DEFAULT_WEIGHTS): number {
  const value = w[grade - 1];
  if (value === undefined) throw new Error(`missing weight for grade ${grade}`);
  return Math.max(0.01, value);
}

export function initDifficulty(grade: Grade, w: number[] = DEFAULT_WEIGHTS): number {
  const w4 = w[4] ?? 0;
  const w5 = w[5] ?? 0;
  return clamp(1, 10, w4 - Math.exp((grade - 3) * w5) + 1);
}

function clamp(low: number, high: number, value: number): number {
  return Math.min(high, Math.max(low, value));
}

export function retrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / Math.max(0.01, stability), DECAY);
}

export function nextInterval(stability: number, retention: number = DESIRED_RETENTION): number {
  return Math.max(1, Math.round((stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1)));
}

export function review(
  card: CardState | null,
  grade: Grade,
  todayDay: number,
  w: number[] = DEFAULT_WEIGHTS,
): CardState {
  if (card === null) {
    const stability = initStability(grade, w);
    return { stability, difficulty: initDifficulty(grade, w), dueDay: todayDay + 1, lastReviewDay: todayDay };
  }
  const elapsed = Math.max(0, todayDay - card.lastReviewDay);
  const retention = retrievability(elapsed, card.stability);
  const stability = nextStability(card, grade, retention, w);
  const difficulty = nextDifficulty(card.difficulty, grade, w);
  return { stability, difficulty, dueDay: todayDay + nextInterval(stability), lastReviewDay: todayDay };
}

function nextDifficulty(difficulty: number, grade: Grade, w: number[]): number {
  const w6 = w[6] ?? 0;
  const w7 = w[7] ?? 0;
  const reference = initDifficulty(4, w);
  return clamp(1, 10, w7 * reference + (1 - w7) * (difficulty - w6 * (grade - 3)));
}

function nextStability(card: CardState, grade: Grade, retention: number, w: number[]): number {
  const w8 = w[8] ?? 0;
  const w9 = w[9] ?? 0;
  const w10 = w[10] ?? 0;
  const w11 = w[11] ?? 0;
  const w12 = w[12] ?? 0;
  const w13 = w[13] ?? 0;
  const w14 = w[14] ?? 0;
  const w15 = w[15] ?? 0;
  const w16 = w[16] ?? 0;
  if (grade === 1) {
    return Math.max(
      0.01,
      w11 *
        Math.pow(card.difficulty, -w12) *
        (Math.pow(card.stability + 1, w13) - 1) *
        Math.exp((1 - retention) * w14),
    );
  }
  const hardPenalty = grade === 2 ? w15 : 1;
  const easyBonus = grade === 4 ? w16 : 1;
  return Math.max(
    0.01,
    card.stability *
      (1 +
        Math.exp(w8) *
          (11 - card.difficulty) *
          Math.pow(card.stability, w9) *
          (Math.exp((1 - retention) * w10) - 1) *
          hardPenalty *
          easyBonus),
  );
}
