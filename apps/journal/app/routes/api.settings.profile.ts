import { data, redirect } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.settings.profile";
import { getSessionUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db";
import { users } from "@trails-cool/db/schema/journal";

export async function action({ request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");

  const formData = await request.formData();
  const displayName = (formData.get("displayName") as string)?.trim() || null;
  const bio = (formData.get("bio") as string)?.trim().slice(0, 160) || null;
  const rawVisibility = formData.get("profileVisibility") as string | null;
  const profileVisibility: "public" | "private" | undefined =
    rawVisibility === "public" || rawVisibility === "private" ? rawVisibility : undefined;

  const db = getDb();
  await db
    .update(users)
    .set({
      displayName,
      bio,
      ...(profileVisibility ? { profileVisibility } : {}),
    })
    .where(eq(users.id, user.id));

  return data({ ok: true });
}
