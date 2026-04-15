import { data } from "react-router";
import { randomUUID } from "node:crypto";
import type { Route } from "./+types/api.integrations.komoot.connect";
import { getSessionUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db";
import { syncConnections } from "@trails-cool/db/schema/journal";
import { login } from "~/lib/komoot.server";
import { encrypt } from "~/lib/crypto.server";

export async function action({ request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) throw data(null, { status: 401 });

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return data({ error: "Email and password are required" }, { status: 400 });
  }

  let credentials: { username: string; token: string };
  try {
    credentials = await login(email, password);
  } catch {
    return data({ error: "Invalid Komoot credentials" }, { status: 400 });
  }

  const encrypted = encrypt(JSON.stringify({ email, password }));

  const db = getDb();
  await db.insert(syncConnections).values({
    id: randomUUID(),
    userId: user.id,
    provider: "komoot",
    accessToken: credentials.token,
    refreshToken: "",
    expiresAt: new Date("2099-12-31"),
    providerUserId: credentials.username,
    encryptedCredentials: encrypted,
  });

  return data({ ok: true });
}
