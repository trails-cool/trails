// POST /api/sync/komoot/import
// Enqueues a background bulk import of all Komoot tours for the connected user.
// Returns { batchId } immediately; poll /api/sync/komoot/import-status for progress.

import { randomUUID } from "node:crypto";
import { data } from "react-router";
import type { Route } from "./+types/api.sync.komoot.import";
import { requireSessionUser } from "~/lib/auth/session.server";
import { getService } from "~/lib/connected-services/manager";
import { enqueue } from "~/lib/boss.server";
import { getDb } from "~/lib/db";
import { importBatches } from "@trails-cool/db/schema/journal";

export async function action({ request }: Route.ActionArgs) {
  const user = await requireSessionUser(request);

  const service = await getService(user.id, "komoot");
  if (!service) return data({ error: "not_connected" }, { status: 400 });

  const db = getDb();
  const batchId = randomUUID();
  await db.insert(importBatches).values({
    id: batchId,
    userId: user.id,
    connectionId: service.id,
    provider: "komoot",
    status: "pending",
  });

  // Only the serviceId crosses the queue — the job resolves fresh
  // credentials through the ConnectedServiceManager at execution time.
  await enqueue("komoot-bulk-import", {
    batchId,
    userId: user.id,
    serviceId: service.id,
  });

  return data({ batchId });
}
