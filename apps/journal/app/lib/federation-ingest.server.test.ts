import { describe, it, expect, vi } from "vitest";

vi.mock("./db.ts", () => ({ getDb: () => ({}) }));

const { parseOutboxItem } = await import("./federation-ingest.server.ts");

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
