// Two-instance federation drive-through (spec: social-federation 11.4).
//
// Talks to the docker-compose harness in e2e/federation/ — two complete
// journal instances (journal-a.test / journal-b.test) federating over a
// private Docker network with real HTTPS between them. This test is the
// driver: it seeds users straight into each instance's database, mints
// a session cookie for alice (cookie sessions are signed with the
// harness's known SESSION_SECRET), follows bob across instances through
// the real /follows/outgoing route, and then watches the entire
// Follow → Accept → first outbox poll → feed pipeline happen between
// two live servers.
//
// Run via e2e/federation/run.sh — it builds the images, pushes the
// schema into both databases, and sets FEDERATION_TWO_INSTANCE=1.

import { describe, it, expect, afterAll } from "vitest";
import postgres, { type Sql } from "postgres";
import { randomUUID } from "node:crypto";
import { createCookieSessionStorage } from "react-router";

const runTwoInstance = process.env.FEDERATION_TWO_INSTANCE === "1";

// Host-published harness endpoints (see e2e/federation/docker-compose.yml).
const A_URL = "http://127.0.0.1:3401";
const B_URL = "http://127.0.0.1:3402";
const DB_A = "postgres://trails:trails@127.0.0.1:5499/trails_a";
const DB_B = "postgres://trails:trails@127.0.0.1:5499/trails_b";
const B_DOMAIN = "journal-b.test";
const BOB_ACTOR_IRI = `https://${B_DOMAIN}/users/bob`;
const ACTIVITY_NAME = "Sunrise ride over the ridge";

/** Poll `fn` until it returns something truthy. */
async function until<T>(
  what: string,
  fn: () => Promise<T | null | undefined | false>,
  timeoutMs = 120_000,
): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function seedUser(sql: Sql, username: string, domain: string): Promise<string> {
  const id = randomUUID();
  await sql`
    INSERT INTO journal.users (id, email, username, domain, profile_visibility, terms_accepted_at, terms_version)
    VALUES (${id}, ${`${username}@${domain}`}, ${username}, ${domain}, 'public', now(), '2026-04-19')
  `;
  return id;
}

/**
 * Mint a valid `__session` cookie for a user. The harness journals run
 * with a known SESSION_SECRET, and sessions are signed cookies (see
 * auth/session.server.ts) — so the driver can authenticate as any
 * seeded user without driving the WebAuthn ceremony.
 */
async function mintSessionCookie(userId: string): Promise<string> {
  const storage = createCookieSessionStorage({
    cookie: {
      name: "__session",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secrets: ["two-instance-test-secret"],
    },
  });
  const session = await storage.getSession();
  session.set("userId", userId);
  const setCookie = await storage.commitSession(session);
  return setCookie.split(";")[0]!;
}

describe.runIf(runTwoInstance)("two-instance federation (11.4)", () => {
  const sqlA = postgres(DB_A, { max: 2 });
  const sqlB = postgres(DB_B, { max: 2 });

  afterAll(async () => {
    await sqlA.end();
    await sqlB.end();
  });

  it(
    "alice@journal-a follows bob@journal-b: Follow → Accept → first poll → bob's public activity in alice's feed",
    { timeout: 300_000 },
    async () => {
      // Both instances are up (run.sh already gated on the compose
      // healthchecks; this is a fail-fast sanity check).
      for (const base of [A_URL, B_URL]) {
        const health = await fetch(`${base}/api/health`);
        expect(health.status).toBe(200);
      }

      // ---- Seed: alice on A; bob + a public activity on B ----------
      const aliceId = await seedUser(sqlA, "alice", "journal-a.test");
      const bobId = await seedUser(sqlB, "bob", B_DOMAIN);
      await sqlB`
        INSERT INTO journal.activities (id, owner_id, name, description, visibility)
        VALUES (${randomUUID()}, ${bobId}, ${ACTIVITY_NAME}, '', 'public')
      `;

      // B serves bob over WebFinger before we point A at him. (Fedify's
      // canonical-origin support means the host-port URL works here.)
      const wf = await fetch(`${B_URL}/.well-known/webfinger?resource=acct:bob@${B_DOMAIN}`);
      expect(wf.status).toBe(200);

      // ---- alice follows bob through the real route -----------------
      const cookie = await mintSessionCookie(aliceId);
      const follow = await fetch(`${A_URL}/follows/outgoing`, {
        method: "POST",
        redirect: "manual",
        headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ intent: "follow", handle: `bob@${B_DOMAIN}` }),
      });
      if (follow.status >= 400) {
        // FollowError surfaces as a 400 with a code — bubble the body
        // up so a harness failure says *why* resolution failed.
        throw new Error(`follow action failed: ${follow.status} ${await follow.text()}`);
      }

      // Outbound resolution (NodeInfo + WebFinger + actor fetch over the
      // Caddy TLS hop) happens inside the action — a Pending row is the
      // proof it all worked.
      const pending = await until("pending follow row on A", async () => {
        const rows = await sqlA`
          SELECT id, accepted_at FROM journal.follows
          WHERE follower_id = ${aliceId} AND followed_actor_iri = ${BOB_ACTOR_IRI}
        `;
        return rows[0];
      }, 30_000);
      expect(pending).toBeDefined();

      // ---- B auto-accepts (public profile) and delivers Accept ------
      await until("Accept to settle the follow on A", async () => {
        const rows = await sqlA`
          SELECT accepted_at FROM journal.follows
          WHERE follower_id = ${aliceId} AND followed_actor_iri = ${BOB_ACTOR_IRI}
        `;
        return rows[0]?.accepted_at != null;
      });

      // B's side sees a remote follower row for alice.
      const bFollow = await sqlB`
        SELECT follower_actor_iri FROM journal.follows WHERE followed_user_id = ${bobId}
      `;
      expect(bFollow[0]?.follower_actor_iri).toBe("https://journal-a.test/users/alice");

      // ---- First poll ingests bob's outbox into A -------------------
      const ingested = await until("bob's activity to be ingested on A", async () => {
        const rows = await sqlA`
          SELECT name, audience, owner_id FROM journal.activities
          WHERE remote_actor_iri = ${BOB_ACTOR_IRI}
        `;
        return rows[0];
      });
      expect(ingested.name).toBe(ACTIVITY_NAME);
      expect(ingested.audience).toBe("public");
      expect(ingested.owner_id).toBeNull();

      // ---- And it shows up in alice's rendered feed ------------------
      const feed = await fetch(`${A_URL}/feed`, { headers: { cookie } });
      expect(feed.status).toBe(200);
      // JSX puts `<!-- -->` separators between adjacent text expressions
      // — strip them so the attribution reads as continuous text.
      const html = (await feed.text()).replaceAll("<!-- -->", "");
      expect(html).toContain(ACTIVITY_NAME);
      expect(html).toContain(`@bob@${B_DOMAIN}`);
    },
  );

  it("an unsigned Create(Note) posted to the inbox is rejected with no DB writes (11.3)", async () => {
    const originIri = `https://intruder.example/notes/${randomUUID()}`;
    const res = await fetch(`${A_URL}/users/alice/inbox`, {
      method: "POST",
      headers: { "content-type": "application/activity+json" },
      body: JSON.stringify({
        "@context": "https://www.w3.org/ns/activitystreams",
        id: `${originIri}#create`,
        type: "Create",
        actor: "https://intruder.example/users/mallory",
        to: "https://www.w3.org/ns/activitystreams#Public",
        object: {
          id: originIri,
          type: "Note",
          content: "<p>Injected note</p>",
        },
      }),
    });
    // Unauthenticated inbox delivery: Fedify refuses it outright
    // (400 malformed / 401 unsigned — both fine, never 2xx).
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    const rows = await sqlA`
      SELECT id FROM journal.activities WHERE remote_origin_iri = ${originIri}
    `;
    expect(rows).toHaveLength(0);
  });
});
