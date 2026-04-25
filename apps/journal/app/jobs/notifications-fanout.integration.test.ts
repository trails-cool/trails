import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../lib/db.ts";
import { activities, follows, users } from "@trails-cool/db/schema/journal";
import { fanout } from "./notifications-fanout.ts";
import { listForUser } from "../lib/notifications.server.ts";

// Same opt-in flag as the rest of the notifications integration tests.
const runIntegration = process.env.NOTIFICATIONS_INTEGRATION === "1";

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
  return id;
}

async function makeFollow(followerId: string, followedId: string, opts: { accepted: boolean } = { accepted: true }) {
  const db = getDb();
  const followedUsername = (await db.select({ u: users.username }).from(users).where(eq(users.id, followedId)))[0]!.u;
  await db.insert(follows).values({
    id: randomUUID(),
    followerId,
    followedActorIri: `https://test.local/users/${followedUsername}`,
    followedUserId: followedId,
    acceptedAt: opts.accepted ? new Date() : null,
  });
}

async function makeActivity(ownerId: string, visibility: "public" | "private" | "unlisted" = "public", name = "Walk") {
  const db = getDb();
  const id = randomUUID();
  await db.insert(activities).values({
    id,
    ownerId,
    name,
    visibility,
  });
  return id;
}

async function wipe() {
  const db = getDb();
  await db.execute(sql`DELETE FROM journal.notifications WHERE recipient_user_id IN (SELECT id FROM journal.users WHERE email LIKE '%@example.test')`);
  await db.execute(sql`DELETE FROM journal.activities WHERE owner_id IN (SELECT id FROM journal.users WHERE email LIKE '%@example.test')`);
  await db.execute(sql`DELETE FROM journal.follows WHERE follower_id IN (SELECT id FROM journal.users WHERE email LIKE '%@example.test')`);
  await db.execute(sql`DELETE FROM journal.users WHERE email LIKE '%@example.test'`);
}

describe.skipIf(!runIntegration)("notifications-fanout integration", () => {
  beforeAll(async () => {
    const db = getDb();
    await db.execute(sql`SELECT 1 FROM journal.notifications LIMIT 0`);
  });
  afterEach(wipe);

  it("inserts exactly one row per accepted follower; pending followers are skipped", async () => {
    const owner = await makeUser({ username: `nf_o_${Date.now()}` });
    const a1 = await makeUser({ username: `nf_a1_${Date.now()}` });
    const a2 = await makeUser({ username: `nf_a2_${Date.now()}` });
    const p1 = await makeUser({ username: `nf_p1_${Date.now()}` });
    const p2 = await makeUser({ username: `nf_p2_${Date.now()}` });
    await makeFollow(a1, owner, { accepted: true });
    await makeFollow(a2, owner, { accepted: true });
    await makeFollow(p1, owner, { accepted: false });
    await makeFollow(p2, owner, { accepted: false });

    const activityId = await makeActivity(owner, "public", "Public Walk");
    await fanout(activityId);

    expect((await listForUser(a1)).length).toBe(1);
    expect((await listForUser(a2)).length).toBe(1);
    expect((await listForUser(p1)).length).toBe(0);
    expect((await listForUser(p2)).length).toBe(0);

    const a1Rows = await listForUser(a1);
    expect(a1Rows[0]?.type).toBe("activity_published");
    expect((a1Rows[0]?.payload as { activityName?: string })?.activityName).toBe("Public Walk");
  });

  it("skips fan-out for non-public activities (defense in depth)", async () => {
    const owner = await makeUser({ username: `nf_np_o_${Date.now()}` });
    const f = await makeUser({ username: `nf_np_f_${Date.now()}` });
    await makeFollow(f, owner, { accepted: true });

    const privateAct = await makeActivity(owner, "private");
    const unlistedAct = await makeActivity(owner, "unlisted");
    await fanout(privateAct);
    await fanout(unlistedAct);

    expect((await listForUser(f)).length).toBe(0);
  });

  it("is idempotent under retry — second fanout doesn't double-insert", async () => {
    const owner = await makeUser({ username: `nf_id_o_${Date.now()}` });
    const f = await makeUser({ username: `nf_id_f_${Date.now()}` });
    await makeFollow(f, owner, { accepted: true });

    const activityId = await makeActivity(owner, "public");
    await fanout(activityId);
    await fanout(activityId);

    expect((await listForUser(f)).length).toBe(1);
  });
});
