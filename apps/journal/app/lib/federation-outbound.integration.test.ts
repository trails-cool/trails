import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.ts";
import { users, follows, remoteActors } from "@trails-cool/db/schema/journal";
import {
  followRemoteActor,
  cancelRemoteFollow,
  listOutgoingRemoteFollows,
  type OutboundFollowDeps,
  type ResolvedRemoteActor,
} from "./federation-outbound.server.ts";
import { FollowError } from "./follow.server.ts";

// Opt-in: real Postgres; network steps injected so no instance is
// contacted. Same convention as the other *.integration.test.ts files.
const runIntegration = process.env.FEDERATION_INTEGRATION === "1";

const REMOTE = "https://other-trails.example/users/alice";
const createdUserIds: string[] = [];

async function makeUser(username: string) {
  const db = getDb();
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: `${username}@example.test`,
    username,
    domain: "test.local",
    profileVisibility: "public",
  });
  createdUserIds.push(id);
  return id;
}

function fakeDeps(opts?: {
  software?: string;
  resolveTo?: ResolvedRemoteActor | null;
}): OutboundFollowDeps & { delivered: string[]; undone: string[] } {
  const delivered: string[] = [];
  const undone: string[] = [];
  return {
    delivered,
    undone,
    async resolveActor() {
      return opts?.resolveTo !== undefined
        ? opts.resolveTo
        : { iri: REMOTE, inboxUrl: `${REMOTE}/inbox`, username: "alice", displayName: "Alice" };
    },
    async fetchSoftwareName() {
      return opts?.software ?? "trails-cool";
    },
    async deliverFollow(_u, followId) {
      delivered.push(followId);
    },
    async deliverUndoFollow(_u, followId) {
      undone.push(followId);
    },
  };
}

describe.runIf(runIntegration)("outbound trails-to-trails follows (integration)", () => {
  beforeAll(() => {
    process.env.ORIGIN ??= "http://localhost:3000";
  });

  afterEach(async () => {
    const db = getDb();
    for (const id of createdUserIds.splice(0)) {
      await db.delete(follows).where(eq(follows.followerId, id));
      await db.delete(users).where(eq(users.id, id));
    }
    await db.delete(remoteActors).where(eq(remoteActors.actorIri, REMOTE));
  });

  it("creates a Pending row, caches the actor, and delivers Follow", async () => {
    const userId = await makeUser(`out-${Date.now()}`);
    const deps = fakeDeps();

    const state = await followRemoteActor(userId, "@alice@other-trails.example", deps);
    expect(state).toEqual({ pending: true, actorIri: REMOTE });
    expect(deps.delivered).toHaveLength(1);

    const db = getDb();
    const [row] = await db.select().from(follows).where(eq(follows.followerId, userId));
    expect(row!.followedActorIri).toBe(REMOTE);
    expect(row!.followedUserId).toBeNull();
    expect(row!.acceptedAt).toBeNull();

    const [cached] = await db.select().from(remoteActors).where(eq(remoteActors.actorIri, REMOTE));
    expect(cached!.inboxUrl).toBe(`${REMOTE}/inbox`);
    expect(cached!.displayName).toBe("Alice");
  });

  it("is idempotent — re-following returns the existing state without re-delivering", async () => {
    const userId = await makeUser(`out-idem-${Date.now()}`);
    const deps = fakeDeps();
    await followRemoteActor(userId, "@alice@other-trails.example", deps);
    const second = await followRemoteActor(userId, "@alice@other-trails.example", deps);
    expect(second.pending).toBe(true);
    expect(deps.delivered).toHaveLength(1);
  });

  it("refuses non-trails instances with a clear code and writes nothing", async () => {
    const userId = await makeUser(`out-mast-${Date.now()}`);
    const deps = fakeDeps({ software: "mastodon" });
    await expect(followRemoteActor(userId, "@alice@other-trails.example", deps)).rejects.toMatchObject({
      code: "not_trails",
    });
    const db = getDb();
    expect(await db.select().from(follows).where(eq(follows.followerId, userId))).toHaveLength(0);
  });

  it("refuses unresolvable handles and local handles", async () => {
    const userId = await makeUser(`out-bad-${Date.now()}`);
    await expect(
      followRemoteActor(userId, "@ghost@other-trails.example", fakeDeps({ resolveTo: null })),
    ).rejects.toMatchObject({ code: "remote_resolve_failed" });
    await expect(followRemoteActor(userId, "not a handle", fakeDeps())).rejects.toMatchObject({
      code: "invalid_handle",
    });
    // Own-host check needs a parseable host (the default localhost:3000
    // fails the TLD shape first) — point ORIGIN at a real-looking domain.
    const prevOrigin = process.env.ORIGIN;
    process.env.ORIGIN = "https://own-instance.example";
    try {
      await expect(
        followRemoteActor(userId, "@someone@own-instance.example", fakeDeps()),
      ).rejects.toMatchObject({ code: "local_handle" });
    } finally {
      process.env.ORIGIN = prevOrigin;
    }
  });

  it("lists outgoing follows and cancel removes the row + delivers Undo", async () => {
    const userId = await makeUser(`out-cancel-${Date.now()}`);
    const deps = fakeDeps();
    await followRemoteActor(userId, "@alice@other-trails.example", deps);

    const entries = await listOutgoingRemoteFollows(userId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ actorIri: REMOTE, pending: true, username: "alice" });

    await cancelRemoteFollow(userId, REMOTE, deps);
    expect(deps.undone).toHaveLength(1);
    expect(await listOutgoingRemoteFollows(userId)).toHaveLength(0);
    // Idempotent second cancel
    await cancelRemoteFollow(userId, REMOTE, deps);
    expect(deps.undone).toHaveLength(1);
  });

  it("FollowError codes are exported for the route layer", () => {
    expect(new FollowError("not_trails", "x").code).toBe("not_trails");
  });
});
