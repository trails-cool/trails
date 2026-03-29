import { redirect } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.settings.delete-account";
import { getSessionUser, destroySession } from "~/lib/auth.server";
import { getDb } from "~/lib/db";
import { users } from "@trails-cool/db/schema/journal";

export async function action({ request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");

  const db = getDb();

  // Delete user — credentials, magic_tokens, routes, activities cascade via FK
  await db.delete(users).where(eq(users.id, user.id));

  const cookie = await destroySession(request);
  return redirect("/", { headers: { "Set-Cookie": cookie } });
}
