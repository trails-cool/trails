import { randomUUID } from "node:crypto";
import { data } from "react-router";
import { eq, and } from "drizzle-orm";
import type { Route } from "./+types/api.integrations.komoot.import";
import { getSessionUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db";
import { syncConnections, importBatches } from "@trails-cool/db/schema/journal";
import { getBoss } from "~/lib/boss.server";

export async function action({ request }: Route.ActionArgs) {
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

  if (!connection?.encryptedCredentials) {
    return data({ error: "Komoot not connected" }, { status: 400 });
  }

  const batchId = randomUUID();
  await db.insert(importBatches).values({
    id: batchId,
    userId: user.id,
    connectionId: connection.id,
    status: "queued",
  });

  const boss = getBoss();
  await boss.send("komoot-import", {
    userId: user.id,
    connectionId: connection.id,
    batchId,
  });

  return data({ batchId });
}
