// ActivityPub federation via Fedify. See openspec/changes/social-federation.
//
// Version pinning (task 1.2): @fedify/fedify is pinned to exactly 2.1.16.
// The whole 2.2.x line is uninstallable from npm — each release depends on
// @fedify/webfinger@2.2.x, which was never published (latest is 2.1.16).
// Revisit the pin once `pnpm view @fedify/fedify dependencies` resolves.
//
// Mounting model: Fedify owns URL dispatch for its endpoints via
// `federation.fetch(request)`. We delegate to it from React Router routes:
//   - /.well-known/webfinger    → resource route (raw Response)
//   - /.well-known/nodeinfo,
//     /nodeinfo/2.1             → resource route (software discovery for
//     the trails-to-trails outbound check — NodeInfo is the fediverse
//     standard for this; the actor-level `software` AS extension the
//     tasks file originally sketched isn't expressible with Fedify's
//     typed vocab, and NodeInfo is what Mastodon et al. actually read)
//   - /users/:username          → route middleware short-circuits to
//     Fedify when the request asks for an ActivityPub representation;
//     browsers fall through to the HTML profile loader
//   - /users/:username/inbox    → resource route (POST), rate-limited
//     per source instance before Fedify verifies the HTTP Signature
//
// Inbox scope (spec: "Narrow inbox — follow-graph activities only"):
// Follow, Undo(Follow), Accept(Follow), Reject(Follow). Fedify returns
// 202 for activity types without a registered listener, which is
// exactly the "acknowledge and drop" the spec wants; the same applies
// to wrapped types we inspect and ignore (e.g. Undo(Like)).
import { configure, getConsoleSink } from "@logtape/logtape";
import { createFederation, type Federation } from "@fedify/fedify";
import { Accept, Follow, Person, Reject, Undo } from "@fedify/fedify/vocab";
import { eq } from "drizzle-orm";
import { users } from "@trails-cool/db/schema/journal";
import { getDb } from "./db.ts";
import { getOrigin } from "./config.server.ts";
import { localActorIri } from "./actor-iri.ts";
import { PostgresKvStore } from "./federation-kv.server.ts";
import { ensureUserKeypair, loadUserKeypair } from "./federation-keys.server.ts";
import { activityToCreate } from "./federation-objects.server.ts";
import {
  OUTBOX_PAGE_SIZE,
  countPublicActivities,
  listPublicActivitiesPage,
} from "./federation-outbox.server.ts";
import {
  recordRemoteFollow,
  removeRemoteFollow,
  settleOutgoingFollow,
  rejectOutgoingFollow,
} from "./federation-inbox.server.ts";
import { enqueueOptional } from "./boss.server.ts";
import { logger } from "./logger.server.ts";

/**
 * Feature flag (task 1.3). All federation surfaces — WebFinger, actor
 * objects, inbox, outbox, NodeInfo — are disabled (404) unless
 * FEDERATION_ENABLED is exactly "true". Default off so schema/code can
 * deploy before any federation traffic is possible.
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

type UserRow = typeof users.$inferSelect;

async function findUserByUsername(username: string): Promise<UserRow | null> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return user ?? null;
}

/**
 * Resolve a *local, public* user from an actor IRI; null otherwise.
 * Matches against our canonical actor IRI shape (`{origin}/users/{name}`,
 * the same shape localActorIri produces).
 */
async function findLocalPublicUserByIri(iri: URL | null): Promise<UserRow | null> {
  if (iri === null) return null;
  const prefix = `${getOrigin()}/users/`;
  if (!iri.href.startsWith(prefix)) return null;
  const username = iri.href.slice(prefix.length);
  if (!username || username.includes("/")) return null;
  const user = await findUserByUsername(username);
  return user && user.profileVisibility === "public" ? user : null;
}

let _federation: Federation<void> | null = null;
let _logtapeConfigured = false;

/**
 * Fedify logs through LogTape, which is silent until configured — and
 * an unconfigured LogTape means signature-verification failures (the
 * single most debuggable federation problem) vanish without a trace.
 * Routed to the console so docker logs / Loki pick them up alongside
 * pino. Level via FEDERATION_LOG_LEVEL (default "info"; set "debug"
 * to see per-request signature verification detail).
 */
function configureFederationLogging(): void {
  if (_logtapeConfigured) return;
  _logtapeConfigured = true;
  const level = (process.env.FEDERATION_LOG_LEVEL ?? "info") as "debug" | "info" | "warning";
  configure({
    sinks: { console: getConsoleSink() },
    loggers: [
      { category: "fedify", lowestLevel: level, sinks: ["console"] },
      // LogTape's meta logger warns about itself; keep it quiet unless
      // something is really wrong.
      { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["console"] },
    ],
  }).catch(() => {
    // configure() throws if something else configured LogTape first —
    // fine, their sinks win.
  });
}

function buildFederation(): Federation<void> {
  configureFederationLogging();
  const federation = createFederation<void>({
    kv: new PostgresKvStore(),
    // Canonical origin so generated IRIs are correct behind the Caddy
    // proxy (the Node server itself only sees plain HTTP).
    origin: getOrigin(),
  });

  federation
    .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
      const user = await findUserByUsername(identifier);
      // Private profiles do not federate at all: returning null makes
      // Fedify respond 404, and WebFinger lookups 404 with it — no leak
      // of user existence (spec: "Private user is invisible to
      // federation").
      if (!user || user.profileVisibility !== "public") return null;
      const keys = await ctx.getActorKeyPairs(identifier);
      return new Person({
        id: ctx.getActorUri(identifier),
        preferredUsername: identifier,
        name: user.displayName ?? user.username,
        summary: user.bio || undefined,
        // Human-facing profile URL — same as the actor IRI by design,
        // declared explicitly so AP clients link browsers to HTML.
        url: new URL(localActorIri(identifier)),
        inbox: ctx.getInboxUri(identifier),
        outbox: ctx.getOutboxUri(identifier),
        // Public keys for inbound HTTP-Signature verification by
        // remotes (Mastodon reads publicKey; newer stacks read the
        // multikey assertionMethods).
        publicKey: keys[0]?.cryptographicKey,
        assertionMethods: keys.map((k) => k.multikey),
      });
    })
    .setKeyPairsDispatcher(async (_ctxData, identifier) => {
      let user = await findUserByUsername(identifier);
      if (!user || user.profileVisibility !== "public") return [];
      // The backfill job normally guarantees keys; generate lazily as a
      // last line of defense (idempotent, guarded on NULL public_key).
      if (!user.publicKey) {
        await ensureUserKeypair(user.id);
        user = await findUserByUsername(identifier);
        if (!user) return [];
      }
      const pair = await loadUserKeypair(user);
      return pair ? [pair] : [];
    });

  // Outbox (spec 5.1/5.2): paginated OrderedCollection of the user's
  // public activities as Create(Note). Unsigned and signed fetches see
  // the same content — the outbox only ever contains public items, so
  // Authorized Fetch adds nothing until locked accounts exist (the
  // spec's two scenarios deliberately collapse to one shape).
  federation
    .setOutboxDispatcher("/users/{identifier}/outbox", async (_ctx, identifier, cursor) => {
      const user = await findUserByUsername(identifier);
      if (!user || user.profileVisibility !== "public") return null;
      const offset = cursor === null ? 0 : Number.parseInt(cursor, 10);
      if (Number.isNaN(offset) || offset < 0) return null;
      const page = await listPublicActivitiesPage(user.id, offset, OUTBOX_PAGE_SIZE);
      return {
        items: page.map((a) => activityToCreate(a, identifier)),
        nextCursor: page.length === OUTBOX_PAGE_SIZE ? String(offset + OUTBOX_PAGE_SIZE) : null,
      };
    })
    .setCounter(async (_ctx, identifier) => {
      const user = await findUserByUsername(identifier);
      if (!user || user.profileVisibility !== "public") return null;
      return countPublicActivities(user.id);
    })
    .setFirstCursor(() => "0");

  federation
    .setInboxListeners("/users/{identifier}/inbox")
    .on(Follow, async (ctx, follow) => {
      // Spec 4.2: Follow from any AP-compatible remote — auto-accept
      // when the local target is public; otherwise drop (the actor
      // already 404s for private users).
      if (follow.id == null || follow.actorId == null || follow.objectId == null) return;
      const parsed = ctx.parseUri(follow.objectId);
      if (parsed?.type !== "actor") return;
      const { outcome } = await recordRemoteFollow(follow.actorId.href, parsed.identifier);
      if (outcome !== "accepted") return;
      const follower = await follow.getActor(ctx);
      if (follower == null) return;
      await ctx.sendActivity(
        { identifier: parsed.identifier },
        follower,
        new Accept({
          id: new URL(`${localActorIri(parsed.identifier)}#accepts/${crypto.randomUUID()}`),
          actor: ctx.getActorUri(parsed.identifier),
          object: follow,
        }),
      );
    })
    .on(Undo, async (ctx, undo) => {
      // Spec 4.3: Undo(Follow) removes the follow row. Other Undos are
      // acknowledged and dropped.
      const object = await undo.getObject(ctx);
      if (!(object instanceof Follow)) return;
      if (undo.actorId == null || object.objectId == null) return;
      const parsed = ctx.parseUri(object.objectId);
      if (parsed?.type !== "actor") return;
      await removeRemoteFollow(undo.actorId.href, parsed.identifier);
    })
    .on(Accept, async (ctx, accept) => {
      // Spec 4.4: a remote accepted our outgoing Follow — settle the
      // Pending row and trigger the first outbox poll for that actor.
      const object = await accept.getObject(ctx);
      if (!(object instanceof Follow)) return;
      if (accept.actorId == null) return;
      const localUser = await findLocalPublicUserByIri(object.actorId);
      if (!localUser) return;
      const { settled } = await settleOutgoingFollow(localUser.id, accept.actorId.href);
      if (settled) {
        // Queue worker lands in the outbox-poll change (task 7.x);
        // enqueueOptional logs-and-continues until then.
        await enqueueOptional("poll-remote-actor", { actorIri: accept.actorId.href }, {
          reason: "first poll after accepted follow",
        });
      }
    })
    .on(Reject, async (ctx, reject) => {
      // Spec 4.5: remote refused our Follow — drop the Pending row.
      const object = await reject.getObject(ctx);
      if (!(object instanceof Follow)) return;
      if (reject.actorId == null) return;
      const localUser = await findLocalPublicUserByIri(object.actorId);
      if (!localUser) return;
      await rejectOutgoingFollow(localUser.id, reject.actorId.href);
    })
    .onError(async (_ctx, error) => {
      logger.warn({ err: error }, "federation: inbox listener error");
    });

  // Software discovery (task 3.4, adapted): NodeInfo is the standard
  // the fediverse uses to identify server software; the trails-to-trails
  // outbound check (task 6.x) reads this from remote instances.
  federation.setNodeInfoDispatcher("/nodeinfo/2.1", () => ({
    software: {
      name: "trails-cool",
      version: process.env.SENTRY_RELEASE ?? "0.0.0-dev",
      homepage: new URL("https://trails.cool/"),
    },
    protocols: ["activitypub"],
    // Deliberately zeroed: publishing per-instance usage counts is a
    // privacy decision we haven't made (privacy manifest, task 10.1).
    usage: { users: {}, localPosts: 0, localComments: 0 },
  }));

  return federation;
}

export function getFederation(): Federation<void> {
  _federation ??= buildFederation();
  return _federation;
}

/**
 * Is this username a local user that federates (exists + public)?
 * Route-level gate for federation surfaces whose collection-level
 * responses Fedify builds without consulting the page dispatcher
 * (e.g. the outbox OrderedCollection) — private users must 404
 * everywhere, mirroring the actor object.
 */
export async function isFederatableUser(username: string): Promise<boolean> {
  const user = await findUserByUsername(username);
  return user !== null && user.profileVisibility === "public";
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

/**
 * Extract the source instance host from an inbound federation request
 * for per-instance rate limiting (spec 4.8). The HTTP Signature keyId
 * is a URL on the sender's instance; its host identifies the instance
 * before any verification work. Unsigned junk shares one tight bucket.
 */
export function federationSourceHost(request: Request): string {
  const signature = request.headers.get("signature") ?? "";
  const match = /keyId="([^"]+)"/.exec(signature);
  if (match?.[1]) {
    try {
      return new URL(match[1]).host;
    } catch {
      // unparseable keyId → shared bucket below
    }
  }
  return "unknown";
}
