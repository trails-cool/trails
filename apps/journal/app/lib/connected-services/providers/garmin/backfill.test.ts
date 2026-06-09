// Unit tests for Garmin backfill chunking + request fan-out
// (spec: garmin-import, "Historical import via backfill").

import { describe, it, expect, vi } from "vitest";

vi.mock("../../manager.ts", () => ({ withFreshCredentials: vi.fn() }));
vi.mock("../../../db.ts", () => ({ getDb: () => ({}) }));

const { chunkRange, BACKFILL_CHUNK_MS } = await import("./backfill.ts");

const DAY = 24 * 60 * 60 * 1000;

describe("chunkRange", () => {
  it("returns a single chunk for ranges within the cap", () => {
    const chunks = chunkRange(0, 30 * DAY);
    expect(chunks).toEqual([{ fromMs: 0, toMs: 30 * DAY }]);
  });

  it("splits ranges larger than the cap, last chunk clamped", () => {
    const chunks = chunkRange(0, 200 * DAY);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual({ fromMs: 0, toMs: BACKFILL_CHUNK_MS });
    expect(chunks[2]!.toMs).toBe(200 * DAY);
    // contiguous, no gaps or overlaps
    expect(chunks[1]!.fromMs).toBe(chunks[0]!.toMs);
    expect(chunks[2]!.fromMs).toBe(chunks[1]!.toMs);
  });

  it("returns [] for empty or inverted ranges", () => {
    expect(chunkRange(5, 5)).toEqual([]);
    expect(chunkRange(10, 5)).toEqual([]);
  });

  it("covers exactly the requested range at chunk boundaries", () => {
    const chunks = chunkRange(0, 2 * BACKFILL_CHUNK_MS);
    expect(chunks).toHaveLength(2);
    expect(chunks[1]).toEqual({
      fromMs: BACKFILL_CHUNK_MS,
      toMs: 2 * BACKFILL_CHUNK_MS,
    });
  });
});
