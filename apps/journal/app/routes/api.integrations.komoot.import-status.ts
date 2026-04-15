import { data } from "react-router";
import { eq, and, desc } from "drizzle-orm";
import type { Route } from "./+types/api.integrations.komoot.import-status";
import { getSessionUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db";
import { syncConnections, importBatches } from "@trails-cool/db/schema/journal";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) throw data(null, { status: 401 });

  const db = getDb();
  const [connection] = await db
    .select()
    .from(syncConnections)
    .where(
      and(
        eq(syncConnections.userId, user.id),
        eq(syncConnections.provider, "komoot"),
      ),
    );

  if (!connection) {
    return data({ batch: null });
  }

  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.connectionId, connection.id))
    .orderBy(desc(importBatches.startedAt))
    .limit(1);

  return data({ batch: batch ?? null });
}
