import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("./db.ts", () => ({ getDb: () => ({}) }));

const {
  parseOutboxItem,
  parseRetryAfter,
  noteHostRateLimited,
  isHostBackingOff,
  resetHostBackoff,
  pollRemoteActor,
  assertRemoteDocSize,
} = await import("./federation-ingest.server.ts");

function trailsCreate(overrides: Record<string, unknown> = {}, noteOverrides: Record<string, unknown> = {}) {
  return {
    type: "Create",
    id: "https://remote.example/activities/a1#create",
    published: "2026-06-01T08:00:00Z",
    object: {
      type: "Note",
      id: "https://remote.example/activities/a1",
      content: "<p>Morning ride</p>\n<p>42.2 km · ↗ 512 m</p>\n<p><a href=\"https://remote.example/activities/a1\">link</a></p>",
      published: "2026-06-01T08:00:00Z",
      to: "as:Public",
      attachment: [
        { type: "PropertyValue", name: "distance-m", value: "42195" },
        { type: "PropertyValue", name: "elevation-gain-m", value: "512" },
        { type: "PropertyValue", name: "duration-s", value: "9000" },
      ],
      ...noteOverrides,
    },
    ...overrides,
  };
}

describe("parseOutboxItem", () => {
  it("parses our own outgoing shape", () => {
    const parsed = parseOutboxItem(trailsCreate());
    expect(parsed).toEqual({
      originIri: "https://remote.example/activities/a1",
      name: "Morning ride",
      distance: 42195,
      elevationGain: 512,
      duration: 9000,
      publishedAt: new Date("2026-06-01T08:00:00Z"),
      audience: "public",
    });
  });

  it("detects all spellings of the public collection", () => {
    for (const to of [
      "https://www.w3.org/ns/activitystreams#Public",
      "as:Public",
      ["as:Public", "https://remote.example/followers"],
    ]) {
      expect(parseOutboxItem(trailsCreate({}, { to }))?.audience).toBe("public");
    }
    expect(parseOutboxItem(trailsCreate({}, { to: "https://remote.example/followers" }))?.audience).toBe(
      "followers-only",
    );
    // cc counts too
    expect(
      parseOutboxItem(trailsCreate({}, { to: undefined, cc: "as:Public" }))?.audience,
    ).toBe("public");
  });

  it("tolerates missing stats and published", () => {
    const parsed = parseOutboxItem(trailsCreate({ published: undefined }, { attachment: undefined, published: undefined }));
    expect(parsed).toMatchObject({ distance: null, elevationGain: null, duration: null, publishedAt: null });
  });

  it("skips anything that isn't Create(Note) with an id and a name", () => {
    expect(parseOutboxItem(null)).toBeNull();
    expect(parseOutboxItem("string")).toBeNull();
    expect(parseOutboxItem({ type: "Announce" })).toBeNull();
    expect(parseOutboxItem(trailsCreate({}, { type: "Article" }))).toBeNull();
    expect(parseOutboxItem(trailsCreate({}, { id: undefined }))).toBeNull();
    expect(parseOutboxItem(trailsCreate({}, { content: "" }))).toBeNull();
  });

  it("strips markup from the name and caps its length", () => {
    const longName = "x".repeat(400);
    const parsed = parseOutboxItem(trailsCreate({}, { content: `<p><b>${longName}</b></p>` }));
    expect(parsed?.name).toHaveLength(300);
    expect(parsed?.name).not.toContain("<b>");
  });
});

describe("429 backoff (7.4)", () => {
  afterEach(() => resetHostBackoff());

  const NOW = Date.parse("2026-06-07T12:00:00Z");

  it("parses Retry-After as delta-seconds and HTTP-date", () => {
    expect(parseRetryAfter("120", NOW)).toBe(120_000);
    expect(parseRetryAfter(" 5 ", NOW)).toBe(5_000);
    expect(parseRetryAfter("Sun, 07 Jun 2026 12:01:00 GMT", NOW)).toBe(60_000);
    // past HTTP-date clamps to zero
    expect(parseRetryAfter("Sun, 07 Jun 2026 11:00:00 GMT", NOW)).toBe(0);
    expect(parseRetryAfter(null, NOW)).toBeNull();
    expect(parseRetryAfter("soon", NOW)).toBeNull();
    expect(parseRetryAfter("-5", NOW)).toBeNull();
  });

  it("falls back to the default and caps absurd Retry-After values", () => {
    // default (no header): 15 min
    expect(noteHostRateLimited("a.example", null, NOW)).toBe(15 * 60 * 1000);
    // honored when reasonable
    expect(noteHostRateLimited("b.example", "120", NOW)).toBe(120_000);
    // capped at the poll interval (1 h)
    expect(noteHostRateLimited("c.example", String(7 * 24 * 3600), NOW)).toBe(60 * 60 * 1000);
  });

  it("backs off the host until the window expires", () => {
    noteHostRateLimited("d.example", "60", NOW);
    expect(isHostBackingOff("d.example", NOW + 59_000)).toBe(true);
    expect(isHostBackingOff("d.example", NOW + 61_000)).toBe(false);
    // expiry clears the entry; a later check stays false
    expect(isHostBackingOff("d.example", NOW)).toBe(false);
    expect(isHostBackingOff("other.example", NOW)).toBe(false);
  });

  it("pollRemoteActor skips a backing-off host before touching the database", async () => {
    // getDb is mocked to {} — any query would throw, so reaching the
    // skip proves the backoff check runs first.
    noteHostRateLimited("limited.example", "3600");
    await expect(pollRemoteActor("https://limited.example/users/alice")).resolves.toEqual({
      skipped: "host rate-limited (backing off)",
    });
  });
});

describe("assertRemoteDocSize", () => {
  it("accepts a normal-sized document", () => {
    expect(() => assertRemoteDocSize({ type: "Person", name: "Alice" })).not.toThrow();
    expect(() => assertRemoteDocSize(null)).not.toThrow();
  });

  it("rejects a document over the 4 MB cap", () => {
    const huge = { type: "OrderedCollection", orderedItems: ["x".repeat(5 * 1024 * 1024)] };
    expect(() => assertRemoteDocSize(huge)).toThrow(/too large/);
  });
});
