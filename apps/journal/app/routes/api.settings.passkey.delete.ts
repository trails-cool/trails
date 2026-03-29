import { data, redirect } from "react-router";
import { eq, and } from "drizzle-orm";
import type { Route } from "./+types/api.settings.passkey.delete";
import { getSessionUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db";
import { credentials } from "@trails-cool/db/schema/journal";

export async function action({ request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");

  const formData = await request.formData();
  const credentialId = formData.get("credentialId") as string;
  if (!credentialId) return data({ error: "Missing credential ID" }, { status: 400 });

  const db = getDb();
  const deleted = await db
    .delete(credentials)
    .where(and(eq(credentials.id, credentialId), eq(credentials.userId, user.id)))
    .returning();

  if (deleted.length === 0) {
    return data({ error: "Passkey not found" }, { status: 404 });
  }

  return redirect("/settings#security");
}
