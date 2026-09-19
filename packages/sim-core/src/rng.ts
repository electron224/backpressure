// packages/sim-core/src/rng.ts
import type { Rng } from "./types.js";

function splitmix32(seed: number): number {
  let z = (seed + 0x9e3779b9) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  return (z ^ (z >>> 15)) >>> 0;
}

export function createRng(seed: number): Rng {
  let s0 = splitmix32(seed) || 1;
  let s1 = splitmix32(seed ^ 0x9e3779b9) || 2;

  function nextUint32(): number {
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= x << 23;
    x ^= x >>> 17;
    x ^= y ^ (y >>> 26);
    s1 = x >>> 0;
    return (s1 + y) >>> 0;
  }

  function next(): number {
    return nextUint32() / 4294967296;
  }

  function nextInt(bound: number): number {
    if (!Number.isInteger(bound) || bound <= 0) {
      throw new Error(`nextInt requires positive integer bound, got ${bound}`);
    }
    return Math.floor(next() * bound);
  }

  function nextExponential(meanMs: number): number {
    if (!(meanMs > 0)) {
      throw new Error(`nextExponential requires meanMs > 0, got ${meanMs}`);
    }
    const u = Math.min(1 - 1e-12, Math.max(1e-12, next()));
    return -Math.log(1 - u) * meanMs;
  }

  return { next, nextInt, nextExponential };
}
