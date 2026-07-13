// Inbound-activity replay defense (spec: federation-operations "Inbound
// replay defense"). The narrow inbox processes Follow/Undo/Accept/Reject;
// none of those carried replay protection before (only Create(Note) did,
// via the activities.remote_origin_iri unique constraint). A hostile or
// buggy remote redelivering a signed activity would re-run its side
// effects. This records each processed activity IRI and lets the inbox
// handlers drop a duplicate before doing anything.

import { lt } from "drizzle-orm";
import { federationProcessedActivities } from "@trails-cool/db/schema/journal";
import { getDb } from "./db.ts";

/**
 * Record an inbound activity IRI, returning whether this is the first
 * time we've seen it. Insert-or-drop: on primary-key conflict no row is
 * inserted and `fresh` is false, so the caller drops the activity as a
 * replay before running side effects.
 *
 * Callers must be idempotent regardless: if a handler fails after this
 * records the IRI, Fedify's retry would be dropped here as a duplicate,
 * so the follow-graph handlers (recordRemoteFollow/removeRemoteFollow/
 * settle/reject) are all safe to under-run.
 */
export async function markInboundActivityProcessed(
  activityIri: string,
): Promise<{ fresh: boolean }> {
  const db = getDb();
  const inserted = await db
    .insert(federationProcessedActivities)
    .values({ activityIri })
    .onConflictDoNothing()
    .returning({ iri: federationProcessedActivities.activityIri });
  return { fresh: inserted.length > 0 };
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Delete processed-activity rows older than 30 days. Called by the
 * `federation-dedup-sweep` job. Returns the number of rows removed.
 */
export async function sweepProcessedActivities(now: Date = new Date()): Promise<number> {
  const db = getDb();
  const cutoff = new Date(now.getTime() - THIRTY_DAYS_MS);
  const deleted = await db
    .delete(federationProcessedActivities)
    .where(lt(federationProcessedActivities.receivedAt, cutoff))
    .returning({ iri: federationProcessedActivities.activityIri });
  return deleted.length;
}
