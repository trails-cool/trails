import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildPoisQuery,
  quantizeBbox,
  deduplicateById,
  queryPois,
  fetchNearbyPois,
  PoiRateLimitError,
  type Poi,
} from "./pois.ts";
import { poiCategories } from "@trails-cool/map-core";

const drinkingWater = poiCategories.filter((c) => c.id === "drinking_water");

describe("buildPoisQuery", () => {
  it("encodes the quantized bbox and category ids", () => {
    const bbox = { south: 52.5, west: 13.3, north: 52.6, east: 13.5 };
    const q = buildPoisQuery(bbox, drinkingWater);
    expect(q).toContain("bbox=52.500,13.300,52.600,13.500");
    expect(q).toContain("categories=drinking_water");
  });

  it("joins multiple categories", () => {
    const cats = poiCategories.filter((c) => ["drinking_water", "camping"].includes(c.id));
    const q = buildPoisQuery({ south: 52.5, west: 13.3, north: 52.6, east: 13.5 }, cats);
    expect(decodeURIComponent(q)).toContain("categories=drinking_water,camping");
  });

  it("produces identical query strings for near-identical viewports in one cell", () => {
    const a = buildPoisQuery(
      { south: 52.5041, west: 13.3072, north: 52.5931, east: 13.4928 },
      drinkingWater,
    );
    const b = buildPoisQuery(
      { south: 52.5039, west: 13.3078, north: 52.5925, east: 13.4921 },
      drinkingWater,
    );
    expect(a).toBe(b);
  });
});

describe("quantizeBbox", () => {
  it("snaps south/west down and north/east up", () => {
    const q = quantizeBbox({ south: 52.5041, west: 13.3072, north: 52.5931, east: 13.4928 }, 0.01);
    expect(q.south).toBeCloseTo(52.5, 10);
    expect(q.west).toBeCloseTo(13.3, 10);
    expect(q.north).toBeCloseTo(52.6, 10);
    expect(q.east).toBeCloseTo(13.5, 10);
  });
});

describe("deduplicateById", () => {
  it("keeps the first occurrence of each id", () => {
    const pois: Poi[] = [
      { id: 1, lat: 52.5, lon: 13.4, category: "drinking_water", tags: {} },
      { id: 1, lat: 52.5, lon: 13.4, category: "camping", tags: {} },
      { id: 2, lat: 52.6, lon: 13.5, category: "shelter", tags: {} },
    ];
    const result = deduplicateById(pois);
    expect(result.map((p) => p.id)).toEqual([1, 2]);
  });
});

describe("queryPois", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("GETs /api/pois with the session header and parses the response", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        pois: [{ id: 7, lat: 52.5, lon: 13.4, name: "Brunnen", category: "drinking_water", tags: {} }],
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const pois = await queryPois(
      { south: 52.5, west: 13.3, north: 52.6, east: 13.5 },
      drinkingWater,
      "sess-1",
    );

    expect(pois).toHaveLength(1);
    expect(pois[0]!.id).toBe(7);
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/pois?bbox=");
    expect(url).toContain("categories=drinking_water");
    expect((opts.headers as Record<string, string>)["X-Trails-Session"]).toBe("sess-1");
    expect(opts.method).toBe("GET");
  });

  it("returns [] without fetching when no categories are enabled", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const pois = await queryPois({ south: 52.5, west: 13.3, north: 52.6, east: 13.5 }, [], "s");
    expect(pois).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws PoiRateLimitError on a 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(
      queryPois({ south: 52.5, west: 13.3, north: 52.6, east: 13.5 }, drinkingWater, "s"),
    ).rejects.toBeInstanceOf(PoiRateLimitError);
  });

  it("throws a generic error on other non-ok statuses (e.g. 503)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(
      queryPois({ south: 52.5, west: 13.3, north: 52.6, east: 13.5 }, drinkingWater, "s"),
    ).rejects.toThrow("POI service error: 503");
  });

  it("deduplicates POIs returned across categories", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          pois: [
            { id: 1, lat: 52.5, lon: 13.4, category: "drinking_water", tags: {} },
            { id: 1, lat: 52.5, lon: 13.4, category: "toilets", tags: {} },
          ],
        }),
      }),
    );
    const pois = await queryPois(
      { south: 52.5, west: 13.3, north: 52.6, east: 13.5 },
      drinkingWater,
      "s",
    );
    expect(pois).toHaveLength(1);
  });
});

describe("fetchNearbyPois", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ pois: [] }) }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("builds a bbox around the point and calls /api/pois", async () => {
    await fetchNearbyPois(50.0, 10.0, 500, drinkingWater, "sess");
    expect(fetch).toHaveBeenCalledOnce();
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toMatch(/\/api\/pois\?bbox=\d+\.\d+,\d+\.\d+,\d+\.\d+,\d+\.\d+/);
    expect(url).toContain("categories=drinking_water");
  });

  it("forwards the AbortSignal to fetch", async () => {
    const controller = new AbortController();
    await fetchNearbyPois(50.0, 10.0, 500, drinkingWater, "sess", controller.signal);
    const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(opts.signal).toBe(controller.signal);
  });
});
