import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { eq, like } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.ts";
import { users, follows, activities, remoteActors } from "@trails-cool/db/schema/journal";
import { listSocialFeed } from "./activities.server.ts";

// Opt-in: real Postgres. Covers social-federation §8 — the audience
// leak guard is THE scenario that must never regress.
const runIntegration = process.env.FEDERATION_INTEGRATION === "1";

const RUN = Date.now();
const REMOTE_ACTOR = `https://feed-origin.example/users/x-${RUN}`;
const createdUserIds: string[] = [];

async function makeUser(suffix: string) {
  const db = getDb();
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: `feed-${suffix}-${RUN}@example.test`,
    username: `feed-${suffix}-${RUN}`,
    domain: "test.local",
    profileVisibility: "public",
  });
  createdUserIds.push(id);
  return id;
}

async function followRemote(followerId: string, accepted: boolean) {
  const db = getDb();
  await db.insert(follows).values({
    id: randomUUID(),
    followerId,
    followedActorIri: REMOTE_ACTOR,
    followedUserId: null,
    acceptedAt: accepted ? new Date() : null,
  });
}

async function remoteActivity(n: number, audience: "public" | "followers-only", publishedAt: Date) {
  const db = getDb();
  await db.insert(activities).values({
    id: randomUUID(),
    ownerId: null,
    name: `Remote ${audience} ${n}`,
    visibility: audience === "public" ? "public" : "private",
    remoteOriginIri: `${REMOTE_ACTOR}/activities/${n}`,
    remoteActorIri: REMOTE_ACTOR,
    remotePublishedAt: publishedAt,
    audience,
  });
}

describe.runIf(runIntegration)("social feed with remote rows (§8, integration)", () => {
  beforeAll(async () => {
    process.env.ORIGIN ??= "http://localhost:3000";
    const db = getDb();
    await db.insert(remoteActors).values({
      actorIri: REMOTE_ACTOR,
      username: "x",
      displayName: "Remote X",
      domain: "feed-origin.example",
    }).onConflictDoNothing();
  });

  afterEach(async () => {
    const db = getDb();
    await db.delete(activities).where(like(activities.remoteOriginIri, `${REMOTE_ACTOR}%`));
    for (const id of createdUserIds.splice(0)) {
      await db.delete(activities).where(eq(activities.ownerId, id));
      await db.delete(follows).where(eq(follows.followerId, id));
      await db.delete(users).where(eq(users.id, id));
    }
  });

  it("followers-only remote content reaches only the viewer with the accepted follow", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    await followRemote(a, true); // A follows X (accepted)
    // B does NOT follow X at all — but the row exists in our DB.
    await remoteActivity(1, "followers-only", new Date());

    const feedA = await listSocialFeed(a);
    const feedB = await listSocialFeed(b);
    expect(feedA.map((r) => r.name)).toContain("Remote followers-only 1");
    expect(feedB.map((r) => r.name)).not.toContain("Remote followers-only 1");
  });

  it("public remote content reaches accepted followers with remote attribution", async () => {
    const a = await makeUser("pub");
    await followRemote(a, true);
    await remoteActivity(2, "public", new Date());

    const feed = await listSocialFeed(a);
    const entry = feed.find((r) => r.name === "Remote public 2");
    expect(entry).toBeDefined();
    expect(entry!.remote).toBe(true);
    expect(entry!.externalUrl).toBe(`${REMOTE_ACTOR}/activities/2`);
    expect(entry!.ownerUsername).toBe("x");
    expect(entry!.ownerDomain).toBe("feed-origin.example");
    expect(entry!.geojson).toBeNull();
  });

  it("pending follows contribute nothing", async () => {
    const a = await makeUser("pend");
    await followRemote(a, false); // Pending
    await remoteActivity(3, "public", new Date());
    expect(await listSocialFeed(a)).toHaveLength(0);
  });

  it("mixes local and remote rows sorted by origin publish time", async () => {
    const viewer = await makeUser("viewer");
    const author = await makeUser("author");
    const db = getDb();
    await db.insert(follows).values({
      id: randomUUID(),
      followerId: viewer,
      followedActorIri: `http://localhost:3000/users/feed-author-${RUN}`,
      followedUserId: author,
      acceptedAt: new Date(),
    });
    await followRemote(viewer, true);

    const now = Date.now();
    // Local activity created "now" (createdAt defaults to now()).
    await db.insert(activities).values({
      id: randomUUID(),
      ownerId: author,
      name: `Local newest ${RUN}`,
      visibility: "public",
    });
    // Remote activity published an hour ago.
    await remoteActivity(4, "public", new Date(now - 3600_000));

    const feed = await listSocialFeed(viewer);
    const names = feed.map((r) => r.name);
    expect(names.indexOf(`Local newest ${RUN}`)).toBeLessThan(names.indexOf("Remote public 4"));
  });
});
