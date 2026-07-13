import { describe, it, expect, afterAll } from "vitest";
import { like, eq } from "drizzle-orm";
import { getDb } from "./db.ts";
import { federationProcessedActivities } from "@trails-cool/db/schema/journal";
import { markInboundActivityProcessed, sweepProcessedActivities } from "./federation-replay.server.ts";

// Opt-in: talks to real Postgres (same convention as the other
// *.integration.test.ts files, e.g. federation-kv).
const runIntegration = process.env.FEDERATION_INTEGRATION === "1";

// Namespace IRIs per run so concurrent runs can't collide.
const NS = `https://replay.test/${Date.now()}`;

describe.runIf(runIntegration)("federation replay defense (integration)", () => {
  afterAll(async () => {
    const db = getDb();
    await db.delete(federationProcessedActivities).where(like(federationProcessedActivities.activityIri, `${NS}%`));
  });

  it("first delivery is fresh, redelivery is dropped as a duplicate", async () => {
    const iri = `${NS}/like/1`;
    expect((await markInboundActivityProcessed(iri)).fresh).toBe(true);
    // The same signed activity delivered again: no-op, reported not fresh.
    expect((await markInboundActivityProcessed(iri)).fresh).toBe(false);
    expect((await markInboundActivityProcessed(iri)).fresh).toBe(false);
  });

  it("distinct activity IRIs are each fresh", async () => {
    expect((await markInboundActivityProcessed(`${NS}/delete/1`)).fresh).toBe(true);
    expect((await markInboundActivityProcessed(`${NS}/update/1`)).fresh).toBe(true);
  });

  it("sweeps rows older than 30 days, keeps recent ones", async () => {
    const db = getDb();
    const oldIri = `${NS}/old`;
    const freshIri = `${NS}/recent`;
    // 31 days ago vs now.
    await db.insert(federationProcessedActivities).values({
      activityIri: oldIri,
      receivedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    });
    await markInboundActivityProcessed(freshIri);

    const purged = await sweepProcessedActivities();
    expect(purged).toBeGreaterThanOrEqual(1);

    const remaining = await db
      .select({ iri: federationProcessedActivities.activityIri })
      .from(federationProcessedActivities)
      .where(eq(federationProcessedActivities.activityIri, oldIri));
    expect(remaining).toHaveLength(0);

    const kept = await db
      .select({ iri: federationProcessedActivities.activityIri })
      .from(federationProcessedActivities)
      .where(eq(federationProcessedActivities.activityIri, freshIri));
    expect(kept).toHaveLength(1);
  });
});
