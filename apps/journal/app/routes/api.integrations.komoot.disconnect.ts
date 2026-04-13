import { data } from "react-router";
import { eq, and } from "drizzle-orm";
import type { Route } from "./+types/api.integrations.komoot.disconnect";
import { getSessionUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db";
import { syncConnections } from "@trails-cool/db/schema/journal";

export async function action({ request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) throw data(null, { status: 401 });

  const db = getDb();
  await db
    .delete(syncConnections)
    .where(
      and(
        eq(syncConnections.userId, user.id),
        eq(syncConnections.provider, "komoot"),
      ),
    );

  return data({ ok: true });
}
