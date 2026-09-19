// packages/sim-core/src/queue.ts
import type { SimEvent } from "./types.js";

export class EventQueue {
  private heap: SimEvent[] = [];
  private nextSeq = 0;

  size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  push(at: number, kind: string, targetId: string, payload?: unknown): void {
    if (!(at >= 0)) {
      throw new Error(`EventQueue.push requires at >= 0, got ${at}`);
    }
    const event: SimEvent = { at, seq: this.nextSeq, kind, targetId, payload };
    this.nextSeq += 1;
    this.heap.push(event);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): SimEvent | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    if (top === undefined) return undefined;
    const last = this.heap.pop();
    if (this.heap.length > 0 && last !== undefined) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  private less(a: SimEvent, b: SimEvent): boolean {
    if (a.at !== b.at) return a.at < b.at;
    return a.seq < b.seq;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      const cur = this.heap[i];
      const par = this.heap[parent];
      if (cur === undefined || par === undefined) break;
      if (!this.less(cur, par)) break;
      this.heap[i] = par;
      this.heap[parent] = cur;
      i = parent;
    }
  }

  private bubbleDown(i: number): void {
    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      let smallestEvent = this.heap[smallest];
      if (smallestEvent === undefined) break;
      const l = this.heap[left];
      if (l !== undefined && this.less(l, smallestEvent)) {
        smallest = left;
        smallestEvent = l;
      }
      const r = this.heap[right];
      if (r !== undefined && this.less(r, smallestEvent)) smallest = right;
      if (smallest === i) break;
      const tmp = this.heap[i];
      const swp = this.heap[smallest];
      if (tmp === undefined || swp === undefined) break;
      this.heap[i] = swp;
      this.heap[smallest] = tmp;
      i = smallest;
    }
  }
}
