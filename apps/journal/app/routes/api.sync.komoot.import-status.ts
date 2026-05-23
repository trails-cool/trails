// GET /api/sync/komoot/import-status
// Returns the most recent import batch for the authenticated user's Komoot connection.

import { data, redirect } from "react-router";
import { desc, eq, and } from "drizzle-orm";
import type { Route } from "./+types/api.sync.komoot.import-status";
import { getSessionUser } from "~/lib/auth/session.server";
import { getService } from "~/lib/connected-services/manager";
import { getDb } from "~/lib/db";
import { importBatches } from "@trails-cool/db/schema/journal";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const service = await getService(user.id, "komoot");
  if (!service) return data({ batch: null });

  const db = getDb();
  const [batch] = await db
    .select()
    .from(importBatches)
    .where(and(eq(importBatches.userId, user.id), eq(importBatches.connectionId, service.id)))
    .orderBy(desc(importBatches.startedAt))
    .limit(1);

  return data({
    batch: batch
      ? {
          id: batch.id,
          status: batch.status,
          totalFound: batch.totalFound,
          importedCount: batch.importedCount,
          duplicateCount: batch.duplicateCount,
          errorMessage: batch.errorMessage,
          startedAt: batch.startedAt.toISOString(),
          completedAt: batch.completedAt?.toISOString() ?? null,
        }
      : null,
  });
}
