import { randomUUID } from "node:crypto";
import { data } from "react-router";
import { eq } from "drizzle-orm";
import { getDb } from "~/lib/db";
import { users, routes } from "@trails-cool/db/schema/journal";
import { createRouteToken } from "~/lib/jwt.server";
import { TERMS_VERSION } from "~/lib/legal";

// Only available when the server is started with E2E=true.
// Never enabled in production.
function assertE2EEnabled() {
  if (process.env.E2E !== "true") {
    throw new Response("Not found", { status: 404 });
  }
}

const E2E_USER_USERNAME = "e2e-test-user";
const E2E_USER_EMAIL = "e2e@localhost";

/**
 * POST /api/e2e/seed
 *
 * Idempotently creates the e2e test user and a bare route (no GPX, no geom),
 * then returns a callback-scoped JWT for that route. Used by e2e tests that
 * need to hit the Planner callback endpoint without going through the browser
 * auth flow.
 *
 * Body: none required. Optionally pass { routeName } to label the route.
 */
export async function action({ request }: { request: Request }) {
  assertE2EEnabled();
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const db = getDb();

  // Upsert the e2e test user
  await db
    .insert(users)
    .values({
      id: randomUUID(),
      username: E2E_USER_USERNAME,
      email: E2E_USER_EMAIL,
      displayName: "E2E Test User",
      domain: "localhost",
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
    })
    .onConflictDoNothing({ target: users.username });

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, E2E_USER_USERNAME));

  if (!user) throw new Error("e2e seed: failed to upsert test user");

  const body = request.headers.get("content-type")?.includes("application/json")
    ? await request.json().catch(() => ({}))
    : {};
  const routeName = (body as { routeName?: string }).routeName ?? "E2E callback test route";

  const routeId = randomUUID();
  await db.insert(routes).values({
    id: routeId,
    ownerId: user.id,
    name: routeName,
    description: "",
  });

  const token = await createRouteToken(routeId);

  return data({ routeId, token, ownerId: user.id });
}
