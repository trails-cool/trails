import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.ts";
import { users, follows, federationBlockedInstances } from "@trails-cool/db/schema/journal";
import {
  isBlockedDomain,
  isBlockedIri,
  filterBlockedDomains,
} from "./federation-blocklist.server.ts";
import { enqueueActivityDeliveries } from "./federation-delivery.server.ts";
import { pollRemoteActor, type PollDeps } from "./federation-ingest.server.ts";
import { setBoss } from "./boss.server.ts";

// Opt-in: real Postgres; no instance is contacted (poll deps injected).
const runIntegration = process.env.FEDERATION_INTEGRATION === "1";

const BLOCKED = `blocked-${Date.now()}.example`;
const ALLOWED = `allowed-${Date.now()}.example`;
const userIds: string[] = [];

describe.runIf(runIntegration)("federation instance blocklist (integration)", () => {
  beforeAll(async () => {
    process.env.FEDERATION_ENABLED = "true";
    process.env.ORIGIN ??= "https://test.local";
    const db = getDb();
    await db.insert(federationBlockedInstances).values({ domain: BLOCKED, reason: "test" });
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(federationBlockedInstances).where(inArray(federationBlockedInstances.domain, [BLOCKED, ALLOWED]));
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
    setBoss(null);
  });

  it("matches blocked domains exactly, by host", async () => {
    expect(await isBlockedDomain(BLOCKED)).toBe(true);
    expect(await isBlockedDomain(ALLOWED)).toBe(false);
    expect(await isBlockedDomain(`sub.${BLOCKED}`)).toBe(false); // exact-host, no subdomain wildcard
  });

  it("isBlockedIri checks the IRI host; unparseable IRIs are treated as blocked", async () => {
    expect(await isBlockedIri(`https://${BLOCKED}/users/x`)).toBe(true);
    expect(await isBlockedIri(`https://${ALLOWED}/users/x`)).toBe(false);
    expect(await isBlockedIri("garbage")).toBe(true);
  });

  it("filterBlockedDomains resolves a batch in one pass", async () => {
    const set = await filterBlockedDomains([BLOCKED, ALLOWED, "another.example"]);
    expect([...set]).toEqual([BLOCKED]);
  });

  it("delivery enqueue: recipients on a blocked domain are filtered out", async () => {
    const db = getDb();
    const ownerId = randomUUID();
    userIds.push(ownerId);
    await db.insert(users).values({
      id: ownerId,
      email: `owner-${ownerId}@example.test`,
      username: `owner_${Date.now()}`,
      domain: "test.local",
      profileVisibility: "public",
    });
    const now = new Date();
    const followedActorIri = `https://test.local/users/owner_${ownerId}`;
    await db.insert(follows).values([
      { id: randomUUID(), followedUserId: ownerId, followedActorIri, followerActorIri: `https://${BLOCKED}/users/a`, acceptedAt: now },
      { id: randomUUID(), followedUserId: ownerId, followedActorIri, followerActorIri: `https://${ALLOWED}/users/b`, acceptedAt: now },
    ]);

    const sent: Array<{ recipientActorIri: string }> = [];
    setBoss({
      async send(_q: string, data: unknown) {
        sent.push(data as { recipientActorIri: string });
        return "id";
      },
    } as unknown as Parameters<typeof setBoss>[0]);

    await enqueueActivityDeliveries(ownerId, randomUUID(), "create");

    // Only the allowed follower gets a delivery job.
    expect(sent).toHaveLength(1);
    expect(sent[0]?.recipientActorIri).toBe(`https://${ALLOWED}/users/b`);
  });

  it("outbox poll refuses a blocked instance without fetching", async () => {
    const deps: PollDeps = {
      async fetchJson() {
        throw new Error("must not fetch a blocked instance");
      },
      async pace() {
        throw new Error("must not pace a blocked instance");
      },
    };
    const result = await pollRemoteActor(`https://${BLOCKED}/users/x`, deps);
    expect(result).toEqual({ skipped: "blocked instance" });
  });
});
