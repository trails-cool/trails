// Server-only loader/action for /sync/import/komoot. See `home.server.ts`.

import { data, redirect } from "react-router";
import { desc, eq, and } from "drizzle-orm";
import { requireSessionUser } from "~/lib/auth/session.server";
import { getService } from "~/lib/connected-services";
import { getDb } from "~/lib/db";
import { importBatches } from "@trails-cool/db/schema/journal";

export async function loadKomootImport(request: Request) {
  const user = await requireSessionUser(request);

  const service = await getService(user.id, "komoot");
  if (!service) throw redirect("/settings/connections/komoot");

  const db = getDb();
  const [batch] = await db
    .select()
    .from(importBatches)
    .where(and(eq(importBatches.userId, user.id), eq(importBatches.connectionId, service.id)))
    .orderBy(desc(importBatches.startedAt))
    .limit(1);

  return {
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
  };
}

export async function komootImportAction(request: Request) {
  await requireSessionUser(request);

  // Delegate to the API route — just redirect so the page reloads with
  // the new batch after the POST.
  const resp = await fetch(
    new URL("/api/sync/komoot/import", new URL(request.url).origin),
    { method: "POST", headers: { cookie: request.headers.get("cookie") ?? "" } },
  );
  if (!resp.ok) {
    const body = (await resp.json()) as { error?: string };
    return data({ error: body.error ?? "failed" }, { status: resp.status });
  }
  return redirect("/sync/import/komoot");
}
