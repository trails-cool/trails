import { describe, it, expect } from "vitest";
import {
  activityToNote,
  activityToCreate,
  activityToDelete,
  activityObjectIri,
  type FederatableActivity,
} from "./federation-objects.server.ts";

const ACTIVITY: FederatableActivity = {
  id: "act-1",
  name: "Morning ride <3",
  description: 'Through the "forest" & hills',
  sportType: "ride",
  distance: 42_195,
  elevationGain: 512.4,
  duration: 2 * 3600 + 30 * 60,
  startedAt: new Date("2026-06-01T08:00:00Z"),
  createdAt: new Date("2026-06-01T12:00:00Z"),
};

describe("activityToNote", () => {
  it("builds a public Note addressed at the activity page", async () => {
    const note = activityToNote(ACTIVITY, "bruno");
    expect(note.id?.href).toBe("http://localhost:3000/activities/act-1");
    expect(note.attributionId?.href).toBe("http://localhost:3000/users/bruno");
    expect(note.toIds.map((u) => u.href)).toContain(
      "https://www.w3.org/ns/activitystreams#Public",
    );
    expect(note.published?.toString()).toBe("2026-06-01T08:00:00Z");
  });

  it("escapes HTML in user content and includes stats + link", () => {
    const note = activityToNote(ACTIVITY, "bruno");
    const content = String(note.content);
    expect(content).toContain("Morning ride &lt;3");
    expect(content).toContain("&quot;forest&quot; &amp; hills");
    expect(content).toContain("42.2 km");
    expect(content).toContain("↗ 512 m");
    expect(content).toContain("2h 30m");
    expect(content).toContain('href="http://localhost:3000/activities/act-1"');
  });

  it("carries structured metadata as PropertyValue attachments", async () => {
    const note = activityToNote(ACTIVITY, "bruno");
    const attachments = [];
    for await (const a of note.getAttachments()) attachments.push(a);
    const byName = new Map(
      attachments.map((a) => [String((a as { name: unknown }).name), String((a as { value: unknown }).value)]),
    );
    expect(byName.get("distance-m")).toBe("42195");
    expect(byName.get("elevation-gain-m")).toBe("512");
    expect(byName.get("duration-s")).toBe("9000");
    expect(byName.get("sport")).toBe("ride");
  });

  it("omits the sport attachment when sport is unset", async () => {
    const note = activityToNote({ ...ACTIVITY, sportType: null }, "bruno");
    const names = [];
    for await (const a of note.getAttachments()) names.push(String((a as { name: unknown }).name));
    expect(names).not.toContain("sport");
  });

  it("omits stats it doesn't have", () => {
    const bare = activityToNote(
      { ...ACTIVITY, distance: null, elevationGain: null, duration: null, description: null },
      "bruno",
    );
    const content = String(bare.content);
    expect(content).not.toContain("km");
    expect(content).not.toContain("↗");
  });

  it("falls back to createdAt when startedAt is missing", () => {
    const note = activityToNote({ ...ACTIVITY, startedAt: null }, "bruno");
    expect(note.published?.toString()).toBe("2026-06-01T12:00:00Z");
  });
});

describe("activityToCreate", () => {
  it("derives a stable id from the object and attributes the actor", () => {
    const create = activityToCreate(ACTIVITY, "bruno");
    expect(create.id?.href).toBe("http://localhost:3000/activities/act-1#create");
    expect(create.actorId?.href).toBe("http://localhost:3000/users/bruno");
  });
});

describe("activityToDelete", () => {
  it("wraps a Tombstone for the deleted object", async () => {
    const del = activityToDelete(activityObjectIri("act-1"), "bruno");
    expect(del.actorId?.href).toBe("http://localhost:3000/users/bruno");
    const tombstone = await del.getObject();
    expect(tombstone?.id?.href).toBe("http://localhost:3000/activities/act-1");
  });
});
