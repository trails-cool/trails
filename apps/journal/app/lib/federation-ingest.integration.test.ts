import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { eq, like } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.ts";
import { users, follows, activities, remoteActors } from "@trails-cool/db/schema/journal";
import { FetchError } from "@fedify/fedify";
import {
  ingestRemoteActivities,
  pollRemoteActor,
  listActorsDuePolling,
  resetHostBackoff,
  type ParsedRemoteActivity,
} from "./federation-ingest.server.ts";

// Opt-in: real Postgres; network injected. Same convention as the
// other *.integration.test.ts files.
const runIntegration = process.env.FEDERATION_INTEGRATION === "1";

const ACTOR = `https://poll-target.example/users/alice-${Date.now()}`;
const createdUserIds: string[] = [];

async function makeFollowerOf(actorIri: string) {
  const db = getDb();
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: `poll-${id}@example.test`,
    username: `poll-${id.slice(0, 8)}`,
    domain: "test.local",
    profileVisibility: "public",
  });
  createdUserIds.push(id);
  await db.insert(follows).values({
    id: randomUUID(),
    followerId: id,
    followedActorIri: actorIri,
    followedUserId: null,
    acceptedAt: new Date(),
  });
  return id;
}

function parsed(n: number, audience: "public" | "followers-only" = "public"): ParsedRemoteActivity {
  return {
    originIri: `${ACTOR}/activities/${n}`,
    name: `Remote activity ${n}`,
    distance: 1000 * n,
    elevationGain: null,
    duration: null,
    publishedAt: new Date(Date.now() - n * 60_000),
    audience,
  };
}

describe.runIf(runIntegration)("outbox-poll ingestion (integration)", () => {
  beforeAll(() => {
    process.env.ORIGIN ??= "http://localhost:3000";
  });

  afterEach(async () => {
    resetHostBackoff();
    const db = getDb();
    await db.delete(activities).where(like(activities.remoteOriginIri, `${ACTOR}%`));
    await db.delete(remoteActors).where(eq(remoteActors.actorIri, ACTOR));
    for (const id of createdUserIds.splice(0)) {
      await db.delete(follows).where(eq(follows.followerId, id));
      await db.delete(users).where(eq(users.id, id));
    }
  });

  it("inserts remote rows with provenance and audience-mirrored visibility", async () => {
    const inserted = await ingestRemoteActivities(ACTOR, [parsed(1), parsed(2, "followers-only")]);
    expect(inserted).toBe(2);

    const db = getDb();
    const rows = await db
      .select()
      .from(activities)
      .where(like(activities.remoteOriginIri, `${ACTOR}%`));
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.ownerId).toBeNull();
      expect(row.remoteActorIri).toBe(ACTOR);
      expect(row.remotePublishedAt).not.toBeNull();
    }
    const byIri = new Map(rows.map((r) => [r.remoteOriginIri, r]));
    expect(byIri.get(`${ACTOR}/activities/1`)?.visibility).toBe("public");
    expect(byIri.get(`${ACTOR}/activities/2`)?.visibility).toBe("private");
    expect(byIri.get(`${ACTOR}/activities/2`)?.audience).toBe("followers-only");
  });

  it("is replay-safe: re-ingesting inserts nothing", async () => {
    await ingestRemoteActivities(ACTOR, [parsed(1), parsed(2)]);
    const again = await ingestRemoteActivities(ACTOR, [parsed(1), parsed(2)]);
    expect(again).toBe(0);
  });

  it("database enforces exactly-one-author invariant", async () => {
    const db = getDb();
    await expect(
      db.insert(activities).values({
        id: randomUUID(),
        ownerId: null,
        remoteActorIri: null,
        name: "orphan",
      }),
    ).rejects.toThrow();
  });

  it("pollRemoteActor resolves the outbox via the actor doc, ingests the first page, stamps last_polled_at", async () => {
    await makeFollowerOf(ACTOR);
    const fetched: string[] = [];
    const result = await pollRemoteActor(ACTOR, {
      async pace() {},
      async fetchJson(url) {
        fetched.push(url);
        if (url === ACTOR) {
          return { outbox: `${ACTOR}/outbox`, inbox: `${ACTOR}/inbox`, preferredUsername: "alice", name: "Alice" };
        }
        if (url === `${ACTOR}/outbox`) {
          return { type: "OrderedCollection", totalItems: 1, first: `${ACTOR}/outbox?cursor=0` };
        }
        return {
          type: "OrderedCollectionPage",
          orderedItems: [
            {
              type: "Create",
              object: {
                type: "Note",
                id: `${ACTOR}/activities/77`,
                content: "<p>Polled ride</p>",
                published: "2026-06-05T10:00:00Z",
                to: "as:Public",
              },
            },
          ],
        };
      },
    });
    expect(result).toEqual({ inserted: 1 });
    expect(fetched).toEqual([ACTOR, `${ACTOR}/outbox`, `${ACTOR}/outbox?cursor=0`]);

    const db = getDb();
    const [cached] = await db.select().from(remoteActors).where(eq(remoteActors.actorIri, ACTOR));
    expect(cached?.outboxUrl).toBe(`${ACTOR}/outbox`);
    expect(cached?.lastPolledAt).not.toBeNull();
  });

  it("skips actors without an accepted local follower", async () => {
    const result = await pollRemoteActor(ACTOR, {
      async pace() {},
      async fetchJson() {
        throw new Error("must not fetch");
      },
    });
    expect(result).toEqual({ skipped: "no accepted local follower" });
  });

  it("a 429 with Retry-After backs off the host; the next poll skips without fetching (7.4)", async () => {
    await makeFollowerOf(ACTOR);
    let fetches = 0;
    const deps = {
      async pace() {},
      async fetchJson(url: string): Promise<unknown> {
        fetches++;
        throw new FetchError(
          new URL(url),
          "rate limited",
          new Response(null, { status: 429, headers: { "Retry-After": "120" } }),
        );
      },
    };
    expect(await pollRemoteActor(ACTOR, deps)).toEqual({ skipped: "rate limited" });
    expect(fetches).toBe(1);

    // Host is now backing off — no network attempt at all.
    expect(await pollRemoteActor(ACTOR, deps)).toEqual({
      skipped: "host rate-limited (backing off)",
    });
    expect(fetches).toBe(1);

    // last_polled_at was NOT stamped, so the sweep will retry later.
    const db = getDb();
    const [cached] = await db.select().from(remoteActors).where(eq(remoteActors.actorIri, ACTOR));
    expect(cached?.lastPolledAt ?? null).toBeNull();
  });

  it("listActorsDuePolling returns followed actors not polled within the hour", async () => {
    await makeFollowerOf(ACTOR);
    expect(await listActorsDuePolling()).toContain(ACTOR);

    const db = getDb();
    await db.insert(remoteActors).values({ actorIri: ACTOR, lastPolledAt: new Date() }).onConflictDoUpdate({
      target: remoteActors.actorIri,
      set: { lastPolledAt: new Date() },
    });
    expect(await listActorsDuePolling()).not.toContain(ACTOR);
  });
});
