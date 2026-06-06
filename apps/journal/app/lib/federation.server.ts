// ActivityPub federation via Fedify. See openspec/changes/social-federation.
//
// Spike scope (task 1.1): a minimal Federation instance serving WebFinger
// discovery + Person actor objects for public users. No keypairs, no inbox
// processing, no delivery yet — those land in later tasks.
//
// Version pinning (task 1.2): @fedify/fedify is pinned to exactly 2.1.16.
// The whole 2.2.x line is uninstallable from npm — each release depends on
// @fedify/webfinger@2.2.x, which was never published (latest is 2.1.16).
// Revisit the pin once `pnpm view @fedify/fedify dependencies` resolves.
//
// Mounting model: Fedify owns URL dispatch for its endpoints via
// `federation.fetch(request)`. We delegate to it from React Router routes:
//   - /.well-known/webfinger  → resource route (no component, raw Response)
//   - /users/:username        → route middleware short-circuits to Fedify
//     when the request asks for an ActivityPub representation; browsers
//     fall through to the HTML profile loader (content negotiation per
//     the design decision "actor IRI is the profile URL").
import { createFederation, MemoryKvStore, type Federation } from "@fedify/fedify";
import { Person } from "@fedify/fedify/vocab";
import { eq } from "drizzle-orm";
import { users } from "@trails-cool/db/schema/journal";
import { getDb } from "./db.ts";
import { getOrigin } from "./config.server.ts";

/**
 * Feature flag (task 1.3). All federation surfaces — WebFinger, actor
 * objects, inbox, outbox — are disabled (404) unless FEDERATION_ENABLED
 * is exactly "true". Default off so schema/code can deploy before any
 * federation traffic is possible.
 */
export function federationEnabled(): boolean {
  return process.env.FEDERATION_ENABLED === "true";
}

/** Does the request ask for an ActivityPub representation of a resource? */
export function wantsActivityJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return (
    accept.includes("application/activity+json") ||
    accept.includes("application/ld+json")
  );
}

let _federation: Federation<void> | null = null;

function buildFederation(): Federation<void> {
  const federation = createFederation<void>({
    // MemoryKvStore is fine for the spike (it only caches remote documents
    // and nonces). Replace with a Postgres-backed store before real
    // federation traffic (revisit in task 4.x).
    kv: new MemoryKvStore(),
    // Canonical origin so generated IRIs are correct behind the Caddy
    // proxy (the Node server itself only sees plain HTTP).
    origin: getOrigin(),
  });

  federation.setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
    const db = getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, identifier))
      .limit(1);
    // Private profiles do not federate at all: returning null makes Fedify
    // respond 404, and WebFinger lookups for this user 404 with it — no
    // leak of user existence (spec: "Private user is invisible to
    // federation").
    if (!user || user.profileVisibility !== "public") return null;
    return new Person({
      id: ctx.getActorUri(identifier),
      preferredUsername: identifier,
      name: user.displayName ?? user.username,
      summary: user.bio || undefined,
      // Human-facing profile URL — same as the actor IRI by design, but
      // declared explicitly so AP clients link browsers to the HTML view.
      url: new URL(`/users/${identifier}`, getOrigin()),
    });
  });

  return federation;
}

export function getFederation(): Federation<void> {
  _federation ??= buildFederation();
  return _federation;
}

/**
 * Delegate a request to Fedify's URL dispatcher. 404s when the feature
 * flag is off so disabled instances are indistinguishable from instances
 * without federation.
 */
export function handleFederationRequest(request: Request): Promise<Response> {
  if (!federationEnabled()) {
    return Promise.resolve(new Response("Not Found", { status: 404 }));
  }
  return getFederation().fetch(request, { contextData: undefined });
}
