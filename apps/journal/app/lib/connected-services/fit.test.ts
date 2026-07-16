import { describe, it, expect, vi } from "vitest";

// Mock fit-file-parser to return whatever synthetic parsed object a test sets,
// so we exercise the converter's logic (segmentation, validation, sport) over
// the parser's OUTPUT shape without needing binary fixtures. `h.parsed` is the
// { records, events, sessions } object fit-file-parser would produce.
const h = vi.hoisted(() => ({ parsed: {} as Record<string, unknown> }));
vi.mock("fit-file-parser", () => ({
  default: class {
    parse(_buffer: unknown, cb: (err: unknown, data: unknown) => void) {
      cb(null, h.parsed);
    }
  },
}));

const { fitToGpx } = await import("./fit.ts");

const buf = Buffer.from("");
const trksegCount = (gpx: string) => (gpx.match(/<trkseg>/g) ?? []).length;
const trkptCount = (gpx: string) => (gpx.match(/<trkpt/g) ?? []).length;

// A GPS record `n` seconds after the base time.
const BASE = Date.parse("2026-01-01T10:00:00Z");
const rec = (secs: number, extra: Record<string, unknown> = {}) => ({
  position_lat: 52.5 + secs * 1e-5,
  position_long: 13.4 + secs * 1e-5,
  altitude: 40 + secs,
  timestamp: new Date(BASE + secs * 1000),
  ...extra,
});

describe("fitToGpx — extraction & validation", () => {
  it("converts GPS records to a GPX track", async () => {
    h.parsed = { records: [rec(0), rec(10), rec(20)] };
    const { gpx } = await fitToGpx(buf, "ride");
    expect(gpx).not.toBeNull();
    expect(trksegCount(gpx!)).toBe(1);
    expect(trkptCount(gpx!)).toBe(3);
    expect(gpx!).toContain("52.5");
  });

  it("returns null gpx for a file with no GPS records (indoor)", async () => {
    h.parsed = {
      records: [{ altitude: 40, timestamp: new Date(BASE) }, { altitude: 41, timestamp: new Date(BASE + 1000) }],
      sessions: [{ sport: "cycling", sub_sport: "indoor_cycling" }],
    };
    const { gpx, sport } = await fitToGpx(buf, "trainer");
    expect(gpx).toBeNull();
    expect(sport).toBe("ride"); // sport still surfaced
  });

  it("drops out-of-range coords and records without a timestamp", async () => {
    h.parsed = {
      records: [
        rec(0),
        { position_lat: 999, position_long: 13.4, timestamp: new Date(BASE + 5000) }, // bad lat
        { position_lat: 52.5, position_long: 13.4 }, // no timestamp
        rec(10),
        rec(20),
      ],
    };
    const { gpx } = await fitToGpx(buf, "r");
    expect(trkptCount(gpx!)).toBe(3); // only the 3 valid records
  });

  it("prefers enhanced_altitude and drops non-finite altitude", async () => {
    h.parsed = {
      records: [
        rec(0, { altitude: 40, enhanced_altitude: 100 }),
        rec(10, { altitude: Infinity }),
        rec(20, { altitude: 42 }),
      ],
    };
    const { gpx } = await fitToGpx(buf, "r");
    expect(gpx!).toContain("<ele>100</ele>"); // enhanced wins
    expect(trkptCount(gpx!)).toBe(3); // non-finite altitude → point kept, no ele
    // the middle point has no <ele>
    expect((gpx!.match(/<ele>/g) ?? []).length).toBe(2);
  });
});

describe("fitToGpx — segmentation", () => {
  it("splits on a timer stop event (short pause, no gap)", async () => {
    h.parsed = {
      records: [rec(0), rec(10), rec(120), rec(130)],
      events: [{ event: "timer", event_type: "stop_all", timestamp: new Date(BASE + 15_000) }],
    };
    const { gpx } = await fitToGpx(buf, "r");
    expect(trksegCount(gpx!)).toBe(2); // split at the pause, not merged
  });

  it("splits on a record gap > 5 min when there are no events", async () => {
    h.parsed = { records: [rec(0), rec(10), rec(400), rec(410)] }; // 390s gap between #2 and #3
    const { gpx } = await fitToGpx(buf, "r");
    expect(trksegCount(gpx!)).toBe(2);
  });

  it("keeps a single segment for a continuous ride", async () => {
    h.parsed = { records: [rec(0), rec(10), rec(20), rec(30)] };
    const { gpx } = await fitToGpx(buf, "r");
    expect(trksegCount(gpx!)).toBe(1);
  });

  it("emits per-session segments for a multisport file (one activity)", async () => {
    h.parsed = {
      records: [rec(0), rec(10), rec(600), rec(610)],
      sessions: [
        { start_time: new Date(BASE), total_elapsed_time: 60, sport: "running" },
        { start_time: new Date(BASE + 600_000), total_elapsed_time: 60, sport: "cycling" },
      ],
    };
    const { gpx } = await fitToGpx(buf, "tri");
    expect(trksegCount(gpx!)).toBe(2); // one segment per session window
  });
});

describe("fitToGpx — sport mapping", () => {
  const sportOf = async (sport?: string, sub_sport?: string) => {
    h.parsed = { records: [rec(0), rec(10)], sessions: [{ sport, sub_sport }] };
    return (await fitToGpx(buf, "r")).sport;
  };

  it("maps base sports and sub-sport refinements", async () => {
    expect(await sportOf("running")).toBe("run");
    expect(await sportOf("cycling")).toBe("ride");
    expect(await sportOf("cycling", "gravel_cycling")).toBe("gravel");
    expect(await sportOf("cycling", "mountain")).toBe("mtb");
    expect(await sportOf("running", "trail")).toBe("run");
    expect(await sportOf("hiking")).toBe("hike");
    expect(await sportOf("walking")).toBe("walk");
    expect(await sportOf("alpine_skiing")).toBe("ski");
    expect(await sportOf("swimming")).toBe("other");
  });

  it("returns null for generic/absent sport (caller falls back to provider)", async () => {
    expect(await sportOf("generic")).toBeNull();
    expect(await sportOf(undefined)).toBeNull();
    h.parsed = { records: [rec(0), rec(10)] }; // no sessions at all
    expect((await fitToGpx(buf, "r")).sport).toBeNull();
  });
});
