import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.ts";
import { activities, users } from "@trails-cool/db/schema/journal";
import {
  listDirectory,
  countDirectory,
  listActiveRecently,
  countFollowersBatch,
} from "./explore.server.ts";
import { loadPersona } from "./demo-bot.server.ts";

// Opt-in: these talk to real Postgres. Gated by EXPLORE_INTEGRATION=1.
const runIntegration = process.env.EXPLORE_INTEGRATION === "1";

async function makeUser(opts: {
  username: string;
  profileVisibility?: "public" | "private";
  bio?: string | null;
}) {
  const db = getDb();
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: `${opts.username}@example.test`,
    username: opts.username,
    domain: "test.local",
    bio: opts.bio ?? null,
    profileVisibility: opts.profileVisibility ?? "public",
  });
  return id;
}

async function makeActivity(opts: {
  ownerId: string;
  visibility?: "public" | "unlisted" | "private";
  createdAt?: Date;
  name?: string;
}) {
  const db = getDb();
  const id = randomUUID();
  await db.insert(activities).values({
    id,
    ownerId: opts.ownerId,
    name: opts.name ?? `act-${id.slice(0, 8)}`,
    visibility: opts.visibility ?? "public",
    createdAt: opts.createdAt ?? new Date(),
  });
  return id;
}

async function wipe() {
  const db = getDb();
  await db.execute(sql`DELETE FROM journal.activities WHERE owner_id IN (SELECT id FROM journal.users WHERE email LIKE '%@example.test')`);
  await db.execute(sql`DELETE FROM journal.follows WHERE follower_id IN (SELECT id FROM journal.users WHERE email LIKE '%@example.test')`);
  await db.execute(sql`DELETE FROM journal.users WHERE email LIKE '%@example.test'`);
}

describe.skipIf(!runIntegration)("explore.server integration", () => {
  beforeAll(async () => {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
  });
  afterEach(wipe);

  it("public user appears in the directory", async () => {
    const id = await makeUser({ username: `ex_pub_${Date.now()}` });
    const { rows, totalCount } = await listDirectory({ page: 1, perPage: 50 });
    expect(rows.find((r) => r.id === id)).toBeDefined();
    expect(totalCount).toBeGreaterThanOrEqual(1);
  });

  it("private user is excluded from the directory", async () => {
    const id = await makeUser({
      username: `ex_priv_${Date.now()}`,
      profileVisibility: "private",
    });
    const { rows } = await listDirectory({ page: 1, perPage: 50 });
    expect(rows.find((r) => r.id === id)).toBeUndefined();
  });

  it("demo persona is excluded from the directory", async () => {
    const persona = loadPersona();
    // Insert a user with the persona's username — should still be filtered out.
    const id = await makeUser({ username: persona.username });
    const { rows } = await listDirectory({ page: 1, perPage: 50 });
    expect(rows.find((r) => r.id === id)).toBeUndefined();
  });

  it("orders by most-recent public activity, NULLS LAST", async () => {
    const stamp = Date.now();
    const aId = await makeUser({ username: `ex_a_${stamp}` });
    const bId = await makeUser({ username: `ex_b_${stamp}` });
    // A has yesterday, B has today.
    await makeActivity({ ownerId: aId, createdAt: new Date(Date.now() - 86_400_000) });
    await makeActivity({ ownerId: bId, createdAt: new Date() });
    const cId = await makeUser({ username: `ex_c_${stamp}` }); // no activities

    const { rows } = await listDirectory({ page: 1, perPage: 50 });
    const indexOf = (id: string) => rows.findIndex((r) => r.id === id);
    expect(indexOf(bId)).toBeGreaterThanOrEqual(0);
    expect(indexOf(aId)).toBeGreaterThan(indexOf(bId)); // B before A
    expect(indexOf(cId)).toBeGreaterThan(indexOf(aId)); // A before C (C is NULL)
  });

  it("private activities don't count for ordering", async () => {
    const stamp = Date.now();
    const aId = await makeUser({ username: `ex_priv_act_a_${stamp}` });
    const bId = await makeUser({ username: `ex_priv_act_b_${stamp}` });
    // A has a private activity from today; B has a public activity from yesterday.
    await makeActivity({ ownerId: aId, visibility: "private", createdAt: new Date() });
    await makeActivity({
      ownerId: bId,
      visibility: "public",
      createdAt: new Date(Date.now() - 86_400_000),
    });
    const { rows } = await listDirectory({ page: 1, perPage: 50 });
    const indexOf = (id: string) => rows.findIndex((r) => r.id === id);
    // B (public yesterday) should come before A (private today is invisible).
    expect(indexOf(bId)).toBeGreaterThanOrEqual(0);
    expect(indexOf(aId)).toBeGreaterThan(indexOf(bId));
  });

  it("'Active recently' includes public users with public activity in last 30 days", async () => {
    const stamp = Date.now();
    const aId = await makeUser({ username: `ex_ar_a_${stamp}` });
    const bId = await makeUser({ username: `ex_ar_b_${stamp}` });
    // A has a public activity from 5 days ago.
    await makeActivity({
      ownerId: aId,
      visibility: "public",
      createdAt: new Date(Date.now() - 5 * 86_400_000),
    });
    // B has a public activity from 60 days ago.
    await makeActivity({
      ownerId: bId,
      visibility: "public",
      createdAt: new Date(Date.now() - 60 * 86_400_000),
    });
    const rows = await listActiveRecently(10);
    expect(rows.find((r) => r.id === aId)).toBeDefined();
    expect(rows.find((r) => r.id === bId)).toBeUndefined();
  });

  it("'Active recently' caps at the requested limit", async () => {
    const stamp = Date.now();
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) {
      const id = await makeUser({ username: `ex_cap_${i}_${stamp}` });
      await makeActivity({
        ownerId: id,
        visibility: "public",
        createdAt: new Date(Date.now() - i * 60_000),
      });
      ids.push(id);
    }
    const rows = await listActiveRecently(3);
    expect(rows.length).toBeLessThanOrEqual(3);
  });

  it("countDirectory matches listDirectory's totalCount", async () => {
    await makeUser({ username: `ex_count_a_${Date.now()}` });
    await makeUser({ username: `ex_count_b_${Date.now()}` });
    const total = await countDirectory();
    const { totalCount } = await listDirectory({ page: 1, perPage: 1 });
    expect(total).toBe(totalCount);
  });

  it("countFollowersBatch handles empty input", async () => {
    const result = await countFollowersBatch([]);
    expect(result.size).toBe(0);
  });

  it("countFollowersBatch fills zeros for users with no followers", async () => {
    const id = await makeUser({ username: `ex_fb_${Date.now()}` });
    const result = await countFollowersBatch([id]);
    expect(result.get(id)).toBe(0);
  });
});
