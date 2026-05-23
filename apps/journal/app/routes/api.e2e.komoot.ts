// POST /api/e2e/komoot
// Seeds a Komoot connection for the e2e test user and returns a session cookie.
// Only available when E2E=true. Never enabled in production.

import { randomUUID } from "node:crypto";
import { data } from "react-router";
import { eq } from "drizzle-orm";
import { getDb } from "~/lib/db";
import { users } from "@trails-cool/db/schema/journal";
import { link } from "~/lib/connected-services/manager";
import { sessionStorage } from "~/lib/auth/session.server";
import { TERMS_VERSION } from "~/lib/legal";

function assertE2EEnabled() {
  if (process.env.E2E !== "true") {
    throw new Response("Not found", { status: 404 });
  }
}

const E2E_USER_USERNAME = "e2e-komoot-user";
const E2E_USER_EMAIL = "e2e-komoot@localhost";
const E2E_KOMOOT_USER_ID = "99999999999";

export async function action({ request }: { request: Request }) {
  assertE2EEnabled();
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const body = request.headers.get("content-type")?.includes("application/json")
    ? ((await request.json().catch(() => ({}))) as { mode?: string })
    : {};
  const mode = body.mode ?? "public";

  const db = getDb();

  // Upsert the e2e komoot test user
  await db
    .insert(users)
    .values({
      id: randomUUID(),
      username: E2E_USER_USERNAME,
      email: E2E_USER_EMAIL,
      displayName: "E2E Komoot User",
      domain: "localhost",
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
    })
    .onConflictDoNothing({ target: users.username });

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, E2E_USER_USERNAME));

  if (!user) throw new Error("e2e komoot seed: failed to upsert test user");

  // Create Komoot connection
  const credentials =
    mode === "authenticated"
      ? { mode: "authenticated", email: "e2e@komoot.test", encryptedPassword: "dummy", komootUserId: E2E_KOMOOT_USER_ID }
      : { mode: "public", komootUserId: E2E_KOMOOT_USER_ID };

  await link({
    userId: user.id,
    provider: "komoot",
    credentialKind: mode === "authenticated" ? "web-login" : "public",
    credentials,
    providerUserId: E2E_KOMOOT_USER_ID,
    grantedScopes: [],
  });

  // Create a session so the test can navigate as this user
  const session = await sessionStorage.getSession();
  session.set("userId", user.id);
  const cookie = await sessionStorage.commitSession(session);

  return data(
    { userId: user.id, username: E2E_USER_USERNAME },
    { headers: { "Set-Cookie": cookie } },
  );
}
