// Server logic for the Garmin import page (spec: garmin-import,
// "Historical import via backfill"). Garmin has no list endpoint, so
// this page is a date-range backfill requester with honest async
// progress — not a pick list.

import { and, desc, eq, gte, count } from "drizzle-orm";
import { requireSessionUser } from "~/lib/auth/session.server";
import { getDb } from "~/lib/db";
import { importBatches, syncImports } from "@trails-cool/db/schema/journal";
import { getService } from "~/lib/connected-services/manager";
import { requestBackfill } from "~/lib/connected-services/providers/garmin/backfill";

export interface GarminBackfillRow {
  id: string;
  rangeStart: string | null;
  rangeEnd: string | null;
  requestedAt: string;
  // Garmin activities imported since this request was made. Activities
  // arrive asynchronously and notifications don't carry a batch id, so
  // "imports since the request" is the honest measurable proxy for
  // range progress (overlapping ranges share arrivals).
  importedSince: number;
}

export async function loadGarminImportPage(request: Request) {
  const user = await requireSessionUser(request);
  const service = await getService(user.id, "garmin");

  if (!service) {
    return { connected: false as const, status: null, batches: [] as GarminBackfillRow[] };
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(importBatches)
    .where(and(eq(importBatches.userId, user.id), eq(importBatches.provider, "garmin")))
    .orderBy(desc(importBatches.startedAt))
    .limit(20);

  const batches: GarminBackfillRow[] = [];
  for (const row of rows) {
    const [imported] = await db
      .select({ n: count() })
      .from(syncImports)
      .where(
        and(
          eq(syncImports.userId, user.id),
          eq(syncImports.provider, "garmin"),
          gte(syncImports.importedAt, row.startedAt),
        ),
      );
    batches.push({
      id: row.id,
      rangeStart: row.rangeStart?.toISOString() ?? null,
      rangeEnd: row.rangeEnd?.toISOString() ?? null,
      requestedAt: row.startedAt.toISOString(),
      importedSince: imported?.n ?? 0,
    });
  }

  return { connected: true as const, status: service.status, batches };
}

export type GarminBackfillActionResult =
  | { ok: true; chunks: number }
  | { ok: false; error: "not_connected" | "needs_relink" | "invalid_range" | "request_failed" };

export async function handleGarminBackfillAction(
  request: Request,
): Promise<GarminBackfillActionResult> {
  const user = await requireSessionUser(request);
  const service = await getService(user.id, "garmin");
  if (!service) return { ok: false, error: "not_connected" };
  if (service.status !== "active") return { ok: false, error: "needs_relink" };

  const form = await request.formData();
  const from = new Date(String(form.get("from") ?? ""));
  const to = new Date(String(form.get("to") ?? ""));
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to || to > new Date()) {
    return { ok: false, error: "invalid_range" };
  }

  try {
    const { chunks } = await requestBackfill({ id: service.id, userId: user.id }, from, to);
    return { ok: true, chunks };
  } catch (e) {
    console.error("garmin backfill request failed:", e);
    return { ok: false, error: "request_failed" };
  }
}
