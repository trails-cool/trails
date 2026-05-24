// Server-only loader for /settings/connections. Pulled out of the route
// file so the component module doesn't pull `getDb` + Drizzle schema
// into its module graph (only the loader does, via `import("...")` at
// load time).

import { eq } from "drizzle-orm";
import { requireSessionUser } from "~/lib/auth/session.server";
import { getDb } from "~/lib/db";
import { connectedServices } from "@trails-cool/db/schema/journal";
import { getAllManifests } from "~/lib/connected-services";

export async function loadConnectionsSettings(request: Request) {
  const user = await requireSessionUser(request);

  const db = getDb();
  const connections = await db
    .select({
      provider: connectedServices.provider,
      providerUserId: connectedServices.providerUserId,
    })
    .from(connectedServices)
    .where(eq(connectedServices.userId, user.id));

  const providers = getAllManifests().map((m) => {
    const conn = connections.find((c) => c.provider === m.id);
    return {
      id: m.id,
      name: m.displayName,
      connected: !!conn,
      providerUserId: conn?.providerUserId,
      connectUrl: m.connectUrl ?? null,
    };
  });

  return { providers };
}
