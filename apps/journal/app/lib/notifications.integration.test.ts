import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.ts";
import { users, notifications } from "@trails-cool/db/schema/journal";
import {
  createNotification,
  listForUser,
  countUnread,
  markRead,
  markAllRead,
  purgeReadOlderThan,
} from "./notifications.server.ts";
import {
  followUser,
  approveFollowRequest,
  listPendingFollowRequests,
} from "./follow.server.ts";

// Opt-in: hits real Postgres. Same convention as demo-bot / follow integration.
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

async function wipe() {
  const db = getDb();
  await db.execute(sql`DELETE FROM journal.notifications WHERE recipient_user_id IN (SELECT id FROM journal.users WHERE email LIKE '%@example.test')`);
  await db.execute(sql`DELETE FROM journal.follows WHERE follower_id IN (SELECT id FROM journal.users WHERE email LIKE '%@example.test')`);
  await db.execute(sql`DELETE FROM journal.users WHERE email LIKE '%@example.test'`);
}

describe.skipIf(!runIntegration)("notifications.server integration", () => {
  beforeAll(async () => {
    const db = getDb();
    await db.execute(sql`SELECT 1 FROM journal.notifications LIMIT 0`);
  });
  afterEach(wipe);

  it("createNotification persists payload + version and is idempotent on (recipient,type,subject)", async () => {
    const a = await makeUser({ username: `n_a_${Date.now()}` });
    const b = await makeUser({ username: `n_b_${Date.now()}` });
    const subject = randomUUID();

    const first = await createNotification({
      type: "activity_published",
      recipientUserId: a,
      actorUserId: b,
      subjectId: subject,
      payload: { activityId: subject, activityName: "Walk", ownerUsername: "b", ownerDisplayName: null },
    });
    expect(first).toBe(true);

    // Re-insert with same (recipient, type, subject_id) is a no-op.
    const second = await createNotification({
      type: "activity_published",
      recipientUserId: a,
      actorUserId: b,
      subjectId: subject,
      payload: { activityId: subject, activityName: "Walk", ownerUsername: "b", ownerDisplayName: null },
    });
    expect(second).toBe(false);

    const rows = await listForUser(a);
    expect(rows.length).toBe(1);
    expect(rows[0]?.payloadVersion).toBe(1);
    expect(rows[0]?.payload).toMatchObject({ activityId: subject });
  });

  it("countUnread excludes read; markRead is owner-bound and idempotent", async () => {
    const a = await makeUser({ username: `n_mr_a_${Date.now()}` });
    const c = await makeUser({ username: `n_mr_c_${Date.now()}` });

    await createNotification({
      type: "follow_received",
      recipientUserId: a,
      actorUserId: null,
      subjectId: null,
      payload: { followerUsername: "x", followerDisplayName: null },
    });
    expect(await countUnread(a)).toBe(1);

    const all = await listForUser(a);
    const id = all[0]!.id;

    // Foreign user can't mark a's notification read.
    expect(await markRead(c, id)).toBe(false);
    expect(await countUnread(a)).toBe(1);

    // Owner can.
    expect(await markRead(a, id)).toBe(true);
    expect(await countUnread(a)).toBe(0);

    // Idempotent — already read, but row still belongs to a, so returns true.
    expect(await markRead(a, id)).toBe(true);
  });

  it("markAllRead clears every unread row of the caller and only the caller", async () => {
    const a = await makeUser({ username: `n_mar_a_${Date.now()}` });
    const b = await makeUser({ username: `n_mar_b_${Date.now()}` });

    await createNotification({
      type: "follow_received",
      recipientUserId: a,
      actorUserId: null,
      subjectId: null,
      payload: { followerUsername: "x", followerDisplayName: null },
    });
    await createNotification({
      type: "follow_received",
      recipientUserId: a,
      actorUserId: null,
      subjectId: null,
      payload: { followerUsername: "y", followerDisplayName: null },
    });
    await createNotification({
      type: "follow_received",
      recipientUserId: b,
      actorUserId: null,
      subjectId: null,
      payload: { followerUsername: "z", followerDisplayName: null },
    });

    const updated = await markAllRead(a);
    expect(updated).toBe(2);
    expect(await countUnread(a)).toBe(0);
    expect(await countUnread(b)).toBe(1);
  });

  it("purgeReadOlderThan removes only read rows past the window", async () => {
    const a = await makeUser({ username: `n_pr_a_${Date.now()}` });

    const db = getDb();
    // Old read (should be purged), old unread (kept), recent read (kept).
    await db.insert(notifications).values([
      {
        id: randomUUID(),
        recipientUserId: a,
        type: "follow_received",
        actorUserId: null,
        subjectId: null,
        payload: { followerUsername: "old-read" },
        payloadVersion: 1,
        readAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      },
      {
        id: randomUUID(),
        recipientUserId: a,
        type: "follow_received",
        actorUserId: null,
        subjectId: null,
        payload: { followerUsername: "old-unread" },
        payloadVersion: 1,
        readAt: null,
        createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      },
      {
        id: randomUUID(),
        recipientUserId: a,
        type: "follow_received",
        actorUserId: null,
        subjectId: null,
        payload: { followerUsername: "recent-read" },
        payloadVersion: 1,
        readAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    ]);

    const purged = await purgeReadOlderThan(90);
    expect(purged).toBe(1);

    const survivors = await db
      .select({ payload: notifications.payload })
      .from(notifications)
      .where(eq(notifications.recipientUserId, a));
    const names = survivors
      .map((s) => (s.payload as { followerUsername?: string } | null)?.followerUsername)
      .sort();
    expect(names).toEqual(["old-unread", "recent-read"]);
  });

  it("followUser → follow_received emitted for public-target auto-accept; idempotent re-follow does NOT double-emit", async () => {
    const a = await makeUser({ username: `n_fr_a_${Date.now()}` });
    const b = await makeUser({ username: `n_fr_b_${Date.now()}` });
    const bRow = (await getDb().select().from(users).where(eq(users.id, b)))[0]!;

    await followUser(a, bRow.username);
    let bRows = await listForUser(b);
    expect(bRows.length).toBe(1);
    expect(bRows[0]?.type).toBe("follow_received");

    // Re-follow is idempotent at the follow layer — and must NOT emit again.
    await followUser(a, bRow.username);
    bRows = await listForUser(b);
    expect(bRows.length).toBe(1);
  });

  it("followUser private-target → follow_request_received; approveFollowRequest → follow_request_approved", async () => {
    const a = await makeUser({ username: `n_fp_a_${Date.now()}` });
    const b = await makeUser({ username: `n_fp_b_${Date.now()}`, profileVisibility: "private" });
    const bRow = (await getDb().select().from(users).where(eq(users.id, b)))[0]!;

    await followUser(a, bRow.username);
    const bRows = await listForUser(b);
    expect(bRows.length).toBe(1);
    expect(bRows[0]?.type).toBe("follow_request_received");

    const reqs = await listPendingFollowRequests(b);
    expect(reqs.length).toBe(1);

    await approveFollowRequest(b, reqs[0]!.id);
    const aRows = await listForUser(a);
    expect(aRows.length).toBe(1);
    expect(aRows[0]?.type).toBe("follow_request_approved");

    // Idempotent re-approval must not double-emit.
    await approveFollowRequest(b, reqs[0]!.id);
    const aRowsAfter = await listForUser(a);
    expect(aRowsAfter.length).toBe(1);
  });
});
