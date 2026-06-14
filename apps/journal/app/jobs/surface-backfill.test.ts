import { describe, it, expect, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("../lib/db.ts", () => ({ getDb: () => ({ execute }) }));

const fetchWaysInBbox = vi.fn();
vi.mock("../lib/overpass-ways.server.ts", () => ({ fetchWaysInBbox: (...a: unknown[]) => fetchWaysInBbox(...a) }));

const emitTo = vi.fn();
vi.mock("../lib/events.server.ts", () => ({ emitTo: (...a: unknown[]) => emitTo(...a) }));

vi.mock("../lib/logger.server.ts", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { runSurfaceBackfill } from "./surface-backfill.ts";

const lineString = (coords: number[][]) => JSON.stringify({ type: "LineString", coordinates: coords });

beforeEach(() => {
  execute.mockReset();
  fetchWaysInBbox.mockReset();
  emitTo.mockReset();
});

describe("runSurfaceBackfill", () => {
  it("matches ways, stores the breakdown, and emits to the owner", async () => {
    execute.mockResolvedValueOnce([
      { geojson: lineString([[0, 0], [0.001, 0], [0.002, 0]]), ownerId: "user-1", hasBreakdown: false },
    ]); // SELECT
    execute.mockResolvedValueOnce(undefined); // UPDATE
    fetchWaysInBbox.mockResolvedValue([
      { highway: "residential", surface: "asphalt", geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.01 }] },
    ]);

    await runSurfaceBackfill("activity", "act-1");

    expect(fetchWaysInBbox).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledTimes(2); // SELECT + UPDATE
    expect(emitTo).toHaveBeenCalledWith("user-1", "surface_breakdown", { kind: "activity", id: "act-1" });
  });

  it("skips a row that already has a breakdown", async () => {
    execute.mockResolvedValueOnce([{ geojson: lineString([[0, 0], [1, 0]]), ownerId: "u", hasBreakdown: true }]);
    await runSurfaceBackfill("route", "r-1");
    expect(fetchWaysInBbox).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1); // only the SELECT
    expect(emitTo).not.toHaveBeenCalled();
  });

  it("does not store or emit when Overpass returns no ways", async () => {
    execute.mockResolvedValueOnce([{ geojson: lineString([[0, 0], [0.001, 0]]), ownerId: "u", hasBreakdown: false }]);
    fetchWaysInBbox.mockResolvedValue([]);
    await runSurfaceBackfill("activity", "a-2");
    expect(execute).toHaveBeenCalledTimes(1); // SELECT only
    expect(emitTo).not.toHaveBeenCalled();
  });
});
