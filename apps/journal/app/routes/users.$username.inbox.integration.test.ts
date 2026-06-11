import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "~/lib/db";
import { users } from "@trails-cool/db/schema/journal";

// Regression guard for the inbox's HTTP Signature requirement. Fedify
// verifies signatures on inbox listeners by default; this fails loudly
// if a future config change or Fedify upgrade silently stops rejecting
// unsigned activities — the property the whole federation trust model
// rests on.
//
// Talks to real Postgres + builds the Fedify instance, so it's gated
// behind FEDERATION_INTEGRATION=1 like the sibling federation
// integration tests (the recipient actor must exist for Fedify to get
// as far as verifying the signature, rather than 404ing).
const runIntegration = process.env.FEDERATION_INTEGRATION === "1";
const ORIGIN = process.env.ORIGIN ?? "http://localhost:3000";

const createdUserIds: string[] = [];

async function makePublicUser(username: string): Promise<void> {
  const db = getDb();
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: `${username}@example.test`,
    username,
    domain: new URL(ORIGIN).host,
    profileVisibility: "public",
  });
  createdUserIds.push(id);
}

function unsignedInboxRequest(username: string): Request {
  return new Request(`${ORIGIN}/users/${username}/inbox`, {
    method: "POST",
    headers: { "Content-Type": "application/activity+json" },
    // Deliberately NO Signature header.
    body: JSON.stringify({
      "@context": "https://www.w3.org/ns/activitystreams",
      id: "https://attacker.example/activities/1",
      type: "Follow",
      actor: "https://attacker.example/users/mallory",
      object: `${ORIGIN}/users/${username}`,
    }),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function routeArgs(request: Request, username: string): any {
  return {
    request,
    params: { username },
    context: {},
    unstable_url: new URL(request.url),
    unstable_pattern: "/users/:username/inbox",
  };
}

describe.runIf(runIntegration)("POST /users/:username/inbox — signature enforcement", () => {
  beforeAll(() => {
    process.env.FEDERATION_ENABLED = "true";
    process.env.ORIGIN ??= ORIGIN;
  });

  afterEach(async () => {
    const db = getDb();
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id));
    }
  });

  it("rejects an unsigned activity with 401 (never 2xx)", async () => {
    const username = `inbox-unsigned-${Date.now()}`;
    await makePublicUser(username);

    const { action } = await import("./users.$username.inbox.ts");
    const resp = (await action(routeArgs(unsignedInboxRequest(username), username))) as Response;

    // The contract that matters: an unsigned activity is never accepted.
    expect(resp.status).toBeGreaterThanOrEqual(400);
    expect(resp.status).toBeLessThan(500);
    expect(resp.status).toBe(401);
  });
});
