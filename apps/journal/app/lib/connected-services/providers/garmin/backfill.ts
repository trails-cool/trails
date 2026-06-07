// Garmin historical import via the Activity API backfill endpoint
// (spec: garmin-import, "Historical import via backfill").
//
// Garmin has no list-activities endpoint: you ask for a time range and
// Garmin re-delivers those activities asynchronously through the same
// notification pipeline the live webhook uses. Each accepted request
// returns 202; the data arrives whenever Garmin gets to it.

import { randomUUID } from "node:crypto";
import { fetchWithTimeout } from "../../../http.server.ts";
import { withFreshCredentials } from "../../manager.ts";
import type { OAuthCredentials } from "../../types.ts";
import { GARMIN_API } from "./constants.ts";

// Garmin caps a single backfill request's window. 90 days per the
// Activity API docs; if program onboarding reveals a different cap for
// our key, this constant is the only thing to change (design.md, open
// questions).
export const BACKFILL_CHUNK_MS = 90 * 24 * 60 * 60 * 1000;

const BACKFILL_URL = `${GARMIN_API}/wellness-api/rest/backfill/activities`;

/**
 * Split [from, to] into Garmin-sized chunks (inclusive bounds, ms).
 * Returns [] for empty/inverted ranges.
 */
export function chunkRange(
  fromMs: number,
  toMs: number,
  chunkMs: number = BACKFILL_CHUNK_MS,
): Array<{ fromMs: number; toMs: number }> {
  if (!(fromMs < toMs) || chunkMs <= 0) return [];
  const chunks: Array<{ fromMs: number; toMs: number }> = [];
  for (let start = fromMs; start < toMs; start += chunkMs) {
    chunks.push({ fromMs: start, toMs: Math.min(start + chunkMs, toMs) });
  }
  return chunks;
}

export interface BackfillDeps {
  requestChunk(
    serviceId: string,
    fromSec: number,
    toSec: number,
  ): Promise<void>;
}

function defaultDeps(): BackfillDeps {
  return {
    async requestChunk(serviceId, fromSec, toSec) {
      await withFreshCredentials(serviceId, async (credentials) => {
        const creds = credentials as OAuthCredentials;
        const url = `${BACKFILL_URL}?summaryStartTimeInSeconds=${fromSec}&summaryEndTimeInSeconds=${toSec}`;
        const resp = await fetchWithTimeout(url, {
          headers: { Authorization: `Bearer ${creds.access_token}` },
        });
        // 202 = accepted. 409 = an identical/overlapping request is
        // already in flight — fine, the data will arrive either way
        // and sync_imports dedupes.
        if (!resp.ok && resp.status !== 409) {
          const text = await resp.text().catch(() => "");
          throw new Error(`Garmin backfill request failed: ${resp.status} ${text}`);
        }
      });
    },
  };
}

/**
 * Issue backfill requests covering [from, to] and persist one
 * import_batches row describing the whole request (progress UX reads
 * it back on the import page).
 */
export async function requestBackfill(
  service: { id: string; userId: string },
  from: Date,
  to: Date,
  deps: BackfillDeps = defaultDeps(),
): Promise<{ batchId: string; chunks: number }> {
  const chunks = chunkRange(from.getTime(), to.getTime());
  if (chunks.length === 0) throw new Error("Empty backfill range");

  for (const chunk of chunks) {
    await deps.requestChunk(
      service.id,
      Math.floor(chunk.fromMs / 1000),
      Math.floor(chunk.toMs / 1000),
    );
  }

  // Record the request for the import page. Lazy import keeps the DB
  // out of this module's graph for pure-function tests (chunkRange).
  const { getDb } = await import("../../../db.ts");
  const { importBatches } = await import("@trails-cool/db/schema/journal");
  const batchId = randomUUID();
  await getDb()
    .insert(importBatches)
    .values({
      id: batchId,
      userId: service.userId,
      connectionId: service.id,
      provider: "garmin",
      // Garmin delivers asynchronously — the batch is "running" from
      // our perspective until the operator-facing page stops caring.
      // totalFound is unknowable up front (no list endpoint).
      status: "running",
      rangeStart: from,
      rangeEnd: to,
    });
  return { batchId, chunks: chunks.length };
}
