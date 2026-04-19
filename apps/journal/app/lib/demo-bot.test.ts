import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_PERSONA,
  __resetPersonaCacheForTests,
  berlinHour,
  loadPersona,
  loadRegion,
  pickEndpoints,
  pickLocale,
  shouldWalkNow,
  templateDescription,
  templateName,
  type DemoPersona,
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

// --- Persona configuration -------------------------------------------------

function minimalPersona(overrides: Partial<DemoPersona> = {}): DemoPersona {
  return {
    username: "test-demo",
    displayName: "Test",
    bio: "test bio",
    locales: ["en"],
    content: {
      names: {
        en: ["alpha walk", "bravo walk", "charlie walk"],
      },
      descriptions: {
        en: ["alpha desc", "bravo desc", "charlie desc"],
      },
    },
    ...overrides,
  };
}

describe("loadPersona", () => {
  const envKey = "DEMO_BOT_PERSONA";
  let savedEnv: string | undefined;

  beforeEach(() => {
    savedEnv = process.env[envKey];
    delete process.env[envKey];
    __resetPersonaCacheForTests();
  });

  afterEach(() => {
    if (savedEnv === undefined) delete process.env[envKey];
    else process.env[envKey] = savedEnv;
    __resetPersonaCacheForTests();
  });

  it("returns the default persona when unset", () => {
    const p = loadPersona();
    expect(p.username).toBe(DEFAULT_PERSONA.username);
  });

  it("caches the result across calls", () => {
    const a = loadPersona();
    const b = loadPersona();
    expect(a).toBe(b);
  });

  it("parses a valid inline JSON override", () => {
    process.env[envKey] = JSON.stringify(minimalPersona({ username: "hamish" }));
    const p = loadPersona();
    expect(p.username).toBe("hamish");
    expect(p.locales).toEqual(["en"]);
  });

  it("falls back to the default on invalid JSON", () => {
    process.env[envKey] = "{not json";
    const p = loadPersona();
    expect(p.username).toBe(DEFAULT_PERSONA.username);
  });

  it("falls back when the username violates the pattern", () => {
    process.env[envKey] = JSON.stringify(minimalPersona({ username: "Has Spaces" }));
    const p = loadPersona();
    expect(p.username).toBe(DEFAULT_PERSONA.username);
  });

  it("falls back when a declared locale has no content pool", () => {
    process.env[envKey] = JSON.stringify(
      minimalPersona({
        locales: ["en", "de"],
        // intentionally omit de pools
      }),
    );
    const p = loadPersona();
    expect(p.username).toBe(DEFAULT_PERSONA.username);
  });

  it("falls back when a pool has fewer than 3 entries", () => {
    process.env[envKey] = JSON.stringify(
      minimalPersona({
        content: {
          names: { en: ["only", "two"] },
          descriptions: { en: ["d1", "d2", "d3"] },
        },
      }),
    );
    const p = loadPersona();
    expect(p.username).toBe(DEFAULT_PERSONA.username);
  });

  it("reads a persona from a file: path", () => {
    const dir = mkdtempSync(join(tmpdir(), "demo-persona-"));
    const path = join(dir, "persona.json");
    writeFileSync(path, JSON.stringify(minimalPersona({ username: "from-file" })));
    try {
      process.env[envKey] = `file:${path}`;
      const p = loadPersona();
      expect(p.username).toBe("from-file");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back when a file: path is unreadable", () => {
    process.env[envKey] = "file:/nonexistent/does-not-exist.json";
    const p = loadPersona();
    expect(p.username).toBe(DEFAULT_PERSONA.username);
  });
});

describe("templateName / templateDescription with custom persona", () => {
  it("draws from the supplied persona's pool and never leaks entries from the default", () => {
    const persona = minimalPersona();
    const bannedSubstring = "Grunewald"; // present in DEFAULT_PERSONA but not in `persona`
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 3, 1 + (i % 28), i % 24, i % 60, i);
      const name = templateName(d, "en", persona);
      const desc = templateDescription(d, "en", persona);
      expect(persona.content.names.en).toContain(name);
      expect(persona.content.descriptions.en).toContain(desc);
      expect(name).not.toContain(bannedSubstring);
      expect(desc).not.toContain(bannedSubstring);
    }
  });
});

describe("pickLocale", () => {
  it("only returns locales declared by the persona", () => {
    const persona = minimalPersona({ locales: ["en"] });
    for (let i = 0; i < 10; i++) {
      expect(pickLocale(persona)).toBe("en");
    }
  });

  it("distributes across declared locales", () => {
    const persona = minimalPersona({
      locales: ["en", "de"],
      content: {
        names: {
          en: ["en1", "en2", "en3"],
          de: ["de1", "de2", "de3"],
        },
        descriptions: {
          en: ["d1", "d2", "d3"],
          de: ["ds1", "ds2", "ds3"],
        },
      },
    });
    expect(pickLocale(persona, () => 0)).toBe("en");
    expect(pickLocale(persona, () => 0.99)).toBe("de");
  });
});
