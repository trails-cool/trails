import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.ts";
import { users, follows } from "@trails-cool/db/schema/journal";
import { localActorIri } from "./actor-iri.ts";
import {
  recordRemoteFollow,
  removeRemoteFollow,
  settleOutgoingFollow,
  rejectOutgoingFollow,
} from "./federation-inbox.server.ts";

// Opt-in: these talk to real Postgres. Gated by an env flag so laptop
// runs without Postgres aren't blocked. Same convention as
// follow.integration.test.ts.
const runIntegration = process.env.FEDERATION_INTEGRATION === "1";

const REMOTE_ACTOR = "https://other-trails.example/users/alice";

const createdUserIds: string[] = [];

async function makeUser(opts: { username: string; profileVisibility?: "public" | "private" }) {
  const db = getDb();
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: `${opts.username}@example.test`,
    username: opts.username,
    domain: "test.local",
    profileVisibility: opts.profileVisibility ?? "public",
  });
  createdUserIds.push(id);
  return id;
}

describe.runIf(runIntegration)("federation inbox (integration)", () => {
  beforeAll(() => {
    process.env.ORIGIN ??= "http://localhost:3000";
  });

  afterEach(async () => {
    const db = getDb();
    for (const id of createdUserIds.splice(0)) {
      await db.delete(follows).where(eq(follows.followedUserId, id));
      await db.delete(follows).where(eq(follows.followerId, id));
      await db.delete(users).where(eq(users.id, id));
    }
  });

  it("inbound Follow on a public user records an accepted remote follow", async () => {
    const username = `fed-pub-${Date.now()}`;
    const userId = await makeUser({ username });

    const { outcome } = await recordRemoteFollow(REMOTE_ACTOR, username);
    expect(outcome).toBe("accepted");

    const db = getDb();
    const rows = await db.select().from(follows).where(eq(follows.followedUserId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.followerActorIri).toBe(REMOTE_ACTOR);
    expect(rows[0]!.followerId).toBeNull();
    expect(rows[0]!.followedActorIri).toBe(localActorIri(username));
    expect(rows[0]!.acceptedAt).not.toBeNull();
  });

  it("inbound Follow is idempotent — replays don't double-insert", async () => {
    const username = `fed-replay-${Date.now()}`;
    const userId = await makeUser({ username });

    await recordRemoteFollow(REMOTE_ACTOR, username);
    await recordRemoteFollow(REMOTE_ACTOR, username);

    const db = getDb();
    const rows = await db.select().from(follows).where(eq(follows.followedUserId, userId));
    expect(rows).toHaveLength(1);
  });

  it("inbound Follow on a private user is refused with no row", async () => {
    const username = `fed-priv-${Date.now()}`;
    const userId = await makeUser({ username, profileVisibility: "private" });

    const { outcome } = await recordRemoteFollow(REMOTE_ACTOR, username);
    expect(outcome).toBe("refused");

    const db = getDb();
    const rows = await db.select().from(follows).where(eq(follows.followedUserId, userId));
    expect(rows).toHaveLength(0);
  });

  it("Undo(Follow) removes the remote follow row", async () => {
    const username = `fed-undo-${Date.now()}`;
    const userId = await makeUser({ username });
    await recordRemoteFollow(REMOTE_ACTOR, username);

    await removeRemoteFollow(REMOTE_ACTOR, username);

    const db = getDb();
    const rows = await db.select().from(follows).where(eq(follows.followedUserId, userId));
    expect(rows).toHaveLength(0);
  });

  it("Accept(Follow) settles a Pending outgoing follow exactly once", async () => {
    const username = `fed-accept-${Date.now()}`;
    const userId = await makeUser({ username });
    const db = getDb();
    await db.insert(follows).values({
      id: randomUUID(),
      followerId: userId,
      followedActorIri: REMOTE_ACTOR,
      acceptedAt: null,
    });

    const first = await settleOutgoingFollow(userId, REMOTE_ACTOR);
    expect(first.settled).toBe(true);
    // A replayed Accept is a no-op (row no longer Pending).
    const second = await settleOutgoingFollow(userId, REMOTE_ACTOR);
    expect(second.settled).toBe(false);

    const rows = await db.select().from(follows).where(eq(follows.followerId, userId));
    expect(rows[0]!.acceptedAt).not.toBeNull();
  });

  it("Reject(Follow) deletes the Pending outgoing follow", async () => {
    const username = `fed-reject-${Date.now()}`;
    const userId = await makeUser({ username });
    const db = getDb();
    await db.insert(follows).values({
      id: randomUUID(),
      followerId: userId,
      followedActorIri: REMOTE_ACTOR,
      acceptedAt: null,
    });

    await rejectOutgoingFollow(userId, REMOTE_ACTOR);

    const rows = await db.select().from(follows).where(eq(follows.followerId, userId));
    expect(rows).toHaveLength(0);
  });

  it("database enforces exactly-one-follower invariant", async () => {
    const username = `fed-check-${Date.now()}`;
    const userId = await makeUser({ username });
    const db = getDb();
    await expect(
      db.insert(follows).values({
        id: randomUUID(),
        // Neither followerId nor followerActorIri — must violate the
        // follows_has_follower_check constraint.
        followedActorIri: localActorIri(username),
        followedUserId: userId,
      }),
    ).rejects.toThrow();
  });
});
