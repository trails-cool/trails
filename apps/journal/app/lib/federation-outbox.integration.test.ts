import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.ts";
import { users, activities, follows } from "@trails-cool/db/schema/journal";

// Opt-in: talks to real Postgres (and exercises the real Fedify
// dispatcher stack via handleFederationRequest). Same convention as the
// other *.integration.test.ts files.
const runIntegration = process.env.FEDERATION_INTEGRATION === "1";

const USERNAME = `outbox-user-${Date.now()}`;
let userId: string;

async function seed() {
  const db = getDb();
  userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    email: `${USERNAME}@example.test`,
    username: USERNAME,
    domain: "test.local",
    profileVisibility: "public",
  });
  // 3 public, 1 unlisted, 1 private — only the 3 public ones federate.
  const mk = (n: number, visibility: "public" | "unlisted" | "private") => ({
    id: randomUUID(),
    ownerId: userId,
    name: `Activity ${n}`,
    visibility,
    distance: 1000 * n,
    createdAt: new Date(Date.now() - n * 60_000),
  });
  await db
    .insert(activities)
    .values([mk(1, "public"), mk(2, "public"), mk(3, "public"), mk(4, "unlisted"), mk(5, "private")]);
}

describe.runIf(runIntegration)("federation outbox (integration)", () => {
  beforeAll(async () => {
    process.env.FEDERATION_ENABLED = "true";
    process.env.ORIGIN ??= "http://localhost:3000";
    await seed();
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(activities).where(eq(activities.ownerId, userId));
    await db.delete(follows).where(eq(follows.followedUserId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  // Mirrors routes/users.$username.outbox.ts: route-level visibility
  // gate first (Fedify's collection-level response doesn't consult the
  // page dispatcher), then delegate to Fedify.
  async function fetchOutbox(path: string): Promise<Response> {
    const { handleFederationRequest, isFederatableUser } = await import("./federation.server.ts");
    if (!(await isFederatableUser(USERNAME))) {
      return new Response("Not Found", { status: 404 });
    }
    return handleFederationRequest(
      new Request(`http://localhost:3000${path}`, {
        headers: { accept: "application/activity+json" },
      }),
    );
  }

  it("serves an OrderedCollection counting only public activities", async () => {
    const res = await fetchOutbox(`/users/${USERNAME}/outbox`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("OrderedCollection");
    expect(body.totalItems).toBe(3);
    expect(body.first).toBeDefined();
  });

  it("pages contain Create(Note) items, public only, newest first", async () => {
    const res = await fetchOutbox(`/users/${USERNAME}/outbox?cursor=0`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const items = Array.isArray(body.orderedItems) ? body.orderedItems : [body.orderedItems];
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.type).toBe("Create");
      expect(item.object.type).toBe("Note");
      expect(item.object.attributedTo).toContain(`/users/${USERNAME}`);
    }
    const names = items.map((i: { object: { content: string } }) => i.object.content);
    expect(names[0]).toContain("Activity 1"); // newest first
    expect(names.join()).not.toContain("Activity 4"); // unlisted excluded
    expect(names.join()).not.toContain("Activity 5"); // private excluded
  });

  it("404s the outbox of a private profile", async () => {
    const db = getDb();
    await db.update(users).set({ profileVisibility: "private" }).where(eq(users.id, userId));
    const res = await fetchOutbox(`/users/${USERNAME}/outbox`);
    expect(res.status).toBe(404);
    await db.update(users).set({ profileVisibility: "public" }).where(eq(users.id, userId));
  });

  it("lists accepted remote followers as the delivery audience", async () => {
    const db = getDb();
    const { listAcceptedRemoteFollowers } = await import("./federation-delivery.server.ts");
    await db.insert(follows).values([
      {
        id: randomUUID(),
        followerActorIri: "https://other.example/users/accepted",
        followedActorIri: `http://localhost:3000/users/${USERNAME}`,
        followedUserId: userId,
        acceptedAt: new Date(),
      },
      {
        id: randomUUID(),
        followerActorIri: "https://other.example/users/pending",
        followedActorIri: `http://localhost:3000/users/${USERNAME}`,
        followedUserId: userId,
        acceptedAt: null,
      },
    ]);
    const audience = await listAcceptedRemoteFollowers(userId);
    expect(audience).toEqual(["https://other.example/users/accepted"]);
  });
});
