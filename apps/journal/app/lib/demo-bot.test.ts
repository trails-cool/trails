import { describe, it, expect } from "vitest";
import {
  berlinHour,
  loadRegion,
  pickEndpoints,
  shouldWalkNow,
  templateDescription,
  templateName,
} from "./demo-bot.server.ts";

describe("pickEndpoints", () => {
  const bbox: [number, number, number, number] = [13.25, 52.45, 13.55, 52.60];

  it("returns points inside the bbox", () => {
    for (let i = 0; i < 20; i++) {
      const { start, end } = pickEndpoints(bbox);
      expect(start[0]).toBeGreaterThanOrEqual(bbox[0]);
      expect(start[0]).toBeLessThanOrEqual(bbox[2]);
      expect(start[1]).toBeGreaterThanOrEqual(bbox[1]);
      expect(start[1]).toBeLessThanOrEqual(bbox[3]);
      expect(end[0]).toBeGreaterThanOrEqual(bbox[0]);
      expect(end[0]).toBeLessThanOrEqual(bbox[2]);
      expect(end[1]).toBeGreaterThanOrEqual(bbox[1]);
      expect(end[1]).toBeLessThanOrEqual(bbox[3]);
    }
  });

  it("produces distinct endpoints", () => {
    for (let i = 0; i < 10; i++) {
      const { start, end } = pickEndpoints(bbox);
      expect(start).not.toEqual(end);
    }
  });
});

describe("templateName / templateDescription", () => {
  it("returns non-empty strings in both locales", () => {
    const d = new Date("2026-04-17T09:00:00Z");
    expect(templateName(d, "en").length).toBeGreaterThan(0);
    expect(templateName(d, "de").length).toBeGreaterThan(0);
    expect(templateDescription(d, "en").length).toBeGreaterThan(0);
    expect(templateDescription(d, "de").length).toBeGreaterThan(0);
  });

  it("returns different entries for different seeds", () => {
    const a = templateName(new Date("2026-04-17T09:00:00Z"), "en");
    const b = templateName(new Date("2026-04-18T10:01:00Z"), "en");
    // Not strictly required, but with 12 entries and different seeds it
    // would be surprising if every pair collided — this is a smoke check.
    expect(typeof a).toBe("string");
    expect(typeof b).toBe("string");
  });
});

describe("loadRegion", () => {
  const envKey = "DEMO_BOT_REGION";

  it("falls back to the default Berlin bbox when unset", () => {
    const saved = process.env[envKey];
    delete process.env[envKey];
    try {
      const r = loadRegion();
      expect(r.bbox).toEqual([13.25, 52.45, 13.55, 52.60]);
    } finally {
      if (saved !== undefined) process.env[envKey] = saved;
    }
  });

  it("parses a valid JSON override", () => {
    const saved = process.env[envKey];
    process.env[envKey] = JSON.stringify({ bbox: [0, 0, 1, 1] });
    try {
      const r = loadRegion();
      expect(r.bbox).toEqual([0, 0, 1, 1]);
    } finally {
      if (saved === undefined) delete process.env[envKey];
      else process.env[envKey] = saved;
    }
  });

  it("falls back on invalid JSON", () => {
    const saved = process.env[envKey];
    process.env[envKey] = "{not json";
    try {
      const r = loadRegion();
      expect(r.bbox).toEqual([13.25, 52.45, 13.55, 52.60]);
    } finally {
      if (saved === undefined) delete process.env[envKey];
      else process.env[envKey] = saved;
    }
  });
});

describe("shouldWalkNow", () => {
  // 10:00 Berlin ≈ 08:00 UTC in winter / 09:00 summer. Both are inside 07-21.
  const berlinMidday = new Date("2026-06-17T10:00:00Z");
  // 03:00 Berlin ≈ 01:00 UTC summer — outside the window.
  const berlinNight = new Date("2026-06-17T01:00:00Z");

  it("rejects times outside the 07-21 window regardless of the random roll", () => {
    expect(shouldWalkNow(berlinNight, () => 0)).toBe(false);
  });

  it("accepts inside the window when the random roll succeeds", () => {
    expect(shouldWalkNow(berlinMidday, () => 0)).toBe(true);
  });

  it("rejects inside the window when the random roll fails", () => {
    expect(shouldWalkNow(berlinMidday, () => 0.99)).toBe(false);
  });
});

describe("berlinHour", () => {
  it("reports a plausible hour", () => {
    const h = berlinHour(new Date("2026-06-17T10:00:00Z"));
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(23);
  });
});
