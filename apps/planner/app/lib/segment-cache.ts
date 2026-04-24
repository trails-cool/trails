// Host-local LRU cache of BRouter segment responses, keyed by
// (from, to, profile, noGoHash). Shrinks BRouter load on rapid edits:
// moving one waypoint only invalidates the two adjacent pair keys, so we
// fetch 2 segments instead of N-1 on every recompute.
//
// Lives only in the elected Yjs host's tab. When the host changes, the
// new host starts cold — acceptable because host handover is rare and
// the penalty is one full recompute.

const DEFAULT_MAX = 500;

export class SegmentCache {
  // Map preserves insertion order, which we use for an LRU eviction
  // policy: get() re-inserts the entry to move it to the tail; set()
  // evicts from the head when over `max`.
  private entries = new Map<string, Record<string, unknown>>();
  private readonly max: number;

  constructor(max: number = DEFAULT_MAX) {
    this.max = max;
  }

  get(key: string): Record<string, unknown> | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    // LRU bump
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: Record<string, unknown>): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
