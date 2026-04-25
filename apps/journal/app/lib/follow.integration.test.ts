import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.ts";
import { users, follows } from "@trails-cool/db/schema/journal";
import {
  followUser,
  unfollowUser,
  getFollowState,
  countFollowers,
  countFollowing,
  FollowError,
} from "./follow.server.ts";

// Opt-in: these talk to real Postgres. Gated by an env flag so laptop
// runs without Postgres aren't blocked. Same convention as
// demo-bot.integration.test.ts.
const runIntegration = process.env.FOLLOW_INTEGRATION === "1";

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
  await db.execute(sql`DELETE FROM journal.follows WHERE follower_id IN (SELECT id FROM journal.users WHERE email LIKE '%@example.test')`);
  await db.execute(sql`DELETE FROM journal.users WHERE email LIKE '%@example.test'`);
}

describe.skipIf(!runIntegration)("follow.server integration", () => {
  beforeAll(async () => {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
  });
  afterEach(wipe);

  it("follow + unfollow cycle on a public profile", async () => {
    const a = await makeUser({ username: `f_a_${Date.now()}` });
    const b = await makeUser({ username: `f_b_${Date.now()}` });
    const aRow = (await getDb().select().from(users).where(eq(users.id, a)))[0]!;
    const bRow = (await getDb().select().from(users).where(eq(users.id, b)))[0]!;

    expect(await getFollowState(a, bRow.username)).toBeNull();

    const s1 = await followUser(a, bRow.username);
    expect(s1).toEqual({ following: true, pending: false });
    expect(await countFollowers(b)).toBe(1);
    expect(await countFollowing(a)).toBe(1);

    // Idempotent
    const s2 = await followUser(a, bRow.username);
    expect(s2).toEqual({ following: true, pending: false });
    expect(await countFollowers(b)).toBe(1);

    const s3 = await unfollowUser(a, bRow.username);
    expect(s3).toEqual({ following: false, pending: false });
    expect(await countFollowers(b)).toBe(0);
    expect(await getFollowState(a, bRow.username)).toBeNull();

    // Idempotent
    const s4 = await unfollowUser(a, bRow.username);
    expect(s4).toEqual({ following: false, pending: false });

    // touch aRow so the variable is read (lint hygiene)
    expect(aRow.username.startsWith("f_a_")).toBe(true);
  });

  it("refuses to follow a private profile", async () => {
    const a = await makeUser({ username: `f_pa_${Date.now()}` });
    const b = await makeUser({ username: `f_pb_${Date.now()}`, profileVisibility: "private" });
    const bRow = (await getDb().select().from(users).where(eq(users.id, b)))[0]!;
    await expect(followUser(a, bRow.username)).rejects.toBeInstanceOf(FollowError);
    await expect(followUser(a, bRow.username)).rejects.toMatchObject({ code: "private_profile" });
    expect(await countFollowing(a)).toBe(0);
  });

  it("refuses self-follow", async () => {
    const a = await makeUser({ username: `f_self_${Date.now()}` });
    const aRow = (await getDb().select().from(users).where(eq(users.id, a)))[0]!;
    await expect(followUser(a, aRow.username)).rejects.toMatchObject({ code: "self_follow" });
  });

  it("404s on unknown username", async () => {
    const a = await makeUser({ username: `f_404_${Date.now()}` });
    await expect(followUser(a, "no_such_user_xyz")).rejects.toMatchObject({ code: "user_not_found" });
    expect(await countFollowing(a)).toBe(0);
    // suppress lint by using afterEach effect indirectly
    expect(typeof a).toBe("string");
    // also touch follows table so the import isn't unused
    const db = getDb();
    const rows = await db.select().from(follows).where(eq(follows.followerId, a));
    expect(rows.length).toBe(0);
  });
});
