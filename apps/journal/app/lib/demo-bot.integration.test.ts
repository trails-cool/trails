import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "./db.ts";
import { activities, routes, users } from "@trails-cool/db/schema/journal";
import {
  DEMO_USERNAME,
  ensureDemoUser,
  generateOneWalk,
  pruneSynthetic,
} from "./demo-bot.server.ts";

// Opt-in: these tests talk to a real Postgres and are skipped unless
// `DEMO_BOT_INTEGRATION=1` is set. CI gates them behind the same flag
// so we don't break laptop runs that have no Postgres up.
const runIntegration = process.env.DEMO_BOT_INTEGRATION === "1";

// A tiny valid GPX that parseGpxAsync can chew on. Two trkpts in Berlin,
// ~2 km apart — enough to pass the 500 m min-distance gate in
// generateOneWalk.
const STUB_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="demo-bot-test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="52.5200" lon="13.4050"><ele>34</ele></trkpt>
    <trkpt lat="52.5300" lon="13.4200"><ele>38</ele></trkpt>
    <trkpt lat="52.5400" lon="13.4350"><ele>40</ele></trkpt>
  </trkseg></trk>
</gpx>`;

async function wipeSynthetic() {
  const db = getDb();
  await db.execute(sql`DELETE FROM journal.activities WHERE synthetic = true`);
  await db.execute(sql`DELETE FROM journal.routes WHERE synthetic = true`);
}

describe.skipIf(!runIntegration)("demo-bot integration", () => {
  beforeAll(async () => {
    // Sanity: make sure we can reach the DB and synthetic column exists.
    const db = getDb();
    await db.execute(sql`SELECT 1 FROM journal.routes WHERE synthetic IS NOT NULL LIMIT 0`);
  });

  afterEach(async () => {
    await wipeSynthetic();
    vi.restoreAllMocks();
  });

  it("ensureDemoUser is idempotent", async () => {
    const id1 = await ensureDemoUser();
    const id2 = await ensureDemoUser();
    expect(id1).toBe(id2);

    const db = getDb();
    const rows = await db
      .select()
      .from(users)
      .where(sql`${users.username} = ${DEMO_USERNAME}`);
    expect(rows.length).toBe(1);
  });

  it("generateOneWalk inserts a public synthetic route + activity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => STUB_GPX }),
    );

    const ownerId = await ensureDemoUser();
    const routeId = await generateOneWalk(ownerId);
    expect(routeId).toBeTruthy();

    const db = getDb();
    const [route] = await db
      .select()
      .from(routes)
      .where(sql`${routes.id} = ${routeId!}`);
    expect(route?.synthetic).toBe(true);
    expect(route?.visibility).toBe("public");
    expect(route?.routingProfile).toBe("trekking");
    expect(route?.ownerId).toBe(ownerId);

    const acts = await db
      .select()
      .from(activities)
      .where(sql`${activities.routeId} = ${routeId!}`);
    expect(acts.length).toBe(1);
    expect(acts[0]?.synthetic).toBe(true);
    expect(acts[0]?.visibility).toBe("public");
    expect(acts[0]?.duration).toBeGreaterThan(0);
  });

  it("pruneSynthetic only removes synthetic rows past the window", async () => {
    const ownerId = await ensureDemoUser();
    const db = getDb();

    // One synthetic route that is 30 days old, one that is fresh.
    await db.execute(sql`
      INSERT INTO journal.routes
        (id, owner_id, name, synthetic, visibility, created_at, updated_at)
      VALUES
        (gen_random_uuid()::text, ${ownerId}, 'old-synth', true, 'public', now() - interval '30 days', now() - interval '30 days'),
        (gen_random_uuid()::text, ${ownerId}, 'fresh-synth', true, 'public', now(), now())
    `);

    // A non-synthetic route that is also 30 days old — must be kept.
    await db.execute(sql`
      INSERT INTO journal.routes
        (id, owner_id, name, synthetic, visibility, created_at, updated_at)
      VALUES
        (gen_random_uuid()::text, ${ownerId}, 'old-real', false, 'private', now() - interval '30 days', now() - interval '30 days')
    `);

    const counts = await pruneSynthetic(14);
    expect(counts.routes).toBe(1);

    const remaining = await db
      .select({ name: routes.name, synthetic: routes.synthetic })
      .from(routes)
      .where(sql`${routes.ownerId} = ${ownerId} AND ${routes.name} IN ('old-synth','fresh-synth','old-real')`);

    const names = remaining.map((r) => r.name).sort();
    expect(names).toEqual(["fresh-synth", "old-real"]);

    // Clean up the non-synthetic test row
    await db.execute(sql`DELETE FROM journal.routes WHERE owner_id = ${ownerId} AND name = 'old-real'`);
  });
});
