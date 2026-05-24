// Server-only loader for /settings/security. See `home.server.ts`.

import { redirect } from "react-router";
import { eq } from "drizzle-orm";
import { getSessionUser } from "~/lib/auth/session.server";
import { getDb } from "~/lib/db";
import { credentials } from "@trails-cool/db/schema/journal";

export async function loadSecuritySettings(request: Request) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");

  const db = getDb();
  const passkeys = await db
    .select({
      id: credentials.id,
      deviceType: credentials.deviceType,
      transports: credentials.transports,
      createdAt: credentials.createdAt,
    })
    .from(credentials)
    .where(eq(credentials.userId, user.id));

  return {
    userId: user.id,
    passkeys: passkeys.map((p) => ({
      id: p.id,
      deviceType: p.deviceType,
      transports: p.transports as string[] | null,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}
