// ActivityPub federation via Fedify. See openspec/changes/social-federation.
//
// Version pinning (task 1.2): @fedify/fedify is pinned exactly (no caret).
// History: 2.2.x was briefly uninstallable from npm (its @fedify/webfinger
// dependency wasn't published) — fixed upstream; upgraded to 2.2.5 on
// 2026-06-07. The exact pin stays deliberate: a federation library defines
// the wire shapes remote instances see, so upgrades should be conscious.
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
import { Accept, Follow, Note, Person, PropertyValue, Reject, Undo } from "@fedify/fedify/vocab";
import { and, eq } from "drizzle-orm";
import { activities, users } from "@trails-cool/db/schema/journal";
import { getDb } from "./db.ts";
import { getOrigin } from "./config.server.ts";
import { localActorIri } from "./actor-iri.ts";
import { PostgresKvStore } from "./federation-kv.server.ts";
import { PgBossMessageQueue } from "./federation-queue.server.ts";
import { markInboundActivityProcessed } from "./federation-replay.server.ts";
import { isBlockedIri } from "./federation-blocklist.server.ts";
import { federationInboxDroppedTotal } from "./metrics.server.ts";
import { ensureUserKeypair, loadUserKeypair } from "./federation-keys.server.ts";
import { activityToCreate, activityToNote } from "./federation-objects.server.ts";
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

/**
 * Whether `id` is one of OUR outgoing Follow activity ids
 * (`<actorIri>#follows/<uuid>`, see federation-outbound.server.ts) and
 * names the recipient of the personal inbox the activity arrived in.
 * Used by the Accept/Reject listeners: another trails instance can't
 * embed a trustworthy copy of our Follow (its id is cross-origin for
 * them), so the id is the only recoverable reference.
 */
function isRecipientFollowUri(ctx: { recipient: string | null }, id: URL | null): boolean {
  if (id == null || ctx.recipient == null) return false;
  if (!id.hash.startsWith("#follows/")) return false;
  return id.href.startsWith(`${localActorIri(ctx.recipient)}#`);
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
    // Message queue so inbox listener execution and outbound deliveries
    // (e.g. the Accept we push back after a Follow) happen asynchronously
    // with Fedify's own retry policy, instead of inside the inbound HTTP
    // request — Mastodon gives deliveries a 10s read timeout, and a slow
    // remote must never make us blow it.
    //
    // Two queueing layers coexist by design: our fan-out jobs
    // (federation-delivery.server.ts enqueues one deliverActivity pg-boss
    // job per follower) feed Fedify, and Fedify's own send/retry
    // scheduling now runs on THIS durable pg-boss-backed queue instead of
    // in-process. Before, in-process meant a deploy or crash dropped every
    // queued delivery and pending retry (spec: fan-out survives a deploy);
    // PgBossMessageQueue closes that. Collapsing the two layers into one
    // is a refactor with no user-visible payoff, so they stay separate.
    queue: new PgBossMessageQueue(),
    // Started explicitly below — keeps vitest runs (which build this
    // instance via handleFederationRequest) free of dangling timers.
    manuallyStartQueue: true,
    // Canonical origin so generated IRIs are correct behind the Caddy
    // proxy (the Node server itself only sees plain HTTP).
    origin: getOrigin(),
    // SSRF-guard opt-out for the two-instance federation harness
    // (e2e/federation/), where both instances live on a private Docker
    // network that Fedify's document loader rightly refuses to fetch
    // from. Testing only — never set this in a real deployment: the
    // private-address block is a genuine security boundary (a malicious
    // actor IRI must not be able to point us at internal targets).
    ...(process.env.FEDERATION_ALLOW_PRIVATE_ADDRESS === "true"
      ? { allowPrivateAddress: true }
      : {}),
  });
  if (!process.env.VITEST) {
    // Fire-and-forget: runs the queue consumer loop for the process
    // lifetime. Dev and prod both reach this on first federation use.
    void federation.startQueue(undefined);
  }

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
        // Mastodon renders PropertyValue attachments as the profile
        // metadata table — a human-visible "this is a trails profile"
        // marker. (The machine-readable marker is NodeInfo; this is
        // flair.) Mastodon strips most HTML in values but keeps links.
        // NOTE: Mastodon's parser requires `attachment` to be a JSON
        // *array* and silently ignores a bare object — and Fedify
        // compacts single-element arrays to bare objects. Keep at least
        // two fields here so the array survives serialization.
        attachments: [
          new PropertyValue({
            name: "🥾 trails.cool",
            value: `<a href="${localActorIri(identifier)}" rel="me">${getOrigin().replace(/^https?:\/\//, "")}/users/${identifier}</a>`,
          }),
          new PropertyValue({
            name: "Instance",
            value: `<a href="${getOrigin()}">${getOrigin().replace(/^https?:\/\//, "")}</a>`,
          }),
        ],
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
      if (await isBlockedIri(follow.actorId.href)) { federationInboxDroppedTotal.inc({ reason: "blocked" }); return; } // silent 202 drop
      if (!(await markInboundActivityProcessed(follow.id.href)).fresh) { federationInboxDroppedTotal.inc({ reason: "duplicate" }); return; } // replay: drop
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
      if (undo.actorId == null) return;
      if (await isBlockedIri(undo.actorId.href)) { federationInboxDroppedTotal.inc({ reason: "blocked" }); return; } // silent 202 drop
      if (undo.id != null && !(await markInboundActivityProcessed(undo.id.href)).fresh) { federationInboxDroppedTotal.inc({ reason: "duplicate" }); return; } // replay: drop
      const undoObjectId = undo.objectId; // capture before dereference (see Accept)
      const object = await undo.getObject(ctx);
      if (object instanceof Follow && object.objectId != null) {
        const parsed = ctx.parseUri(object.objectId);
        if (parsed?.type !== "actor") return;
        await removeRemoteFollow(undo.actorId.href, parsed.identifier);
        return;
      }
      // trails→trails fallback: another trails instance's Undo embeds
      // a Follow whose id lives on the SENDER's domain, but the embed
      // is cross-origin relative to nothing we can verify, and
      // dereferencing `…#follows/<id>` yields the sender's actor
      // document, not a Follow (fragments aren't separately fetchable).
      // Our Follow ids are `<actorIri>#follows/<uuid>` — when the Undo
      // names one owned by the authenticated sender, the recipient of
      // this personal inbox is the unfollowed user.
      if (
        ctx.recipient != null &&
        undoObjectId?.hash.startsWith("#follows/") &&
        undoObjectId.origin === new URL(undo.actorId.href).origin
      ) {
        await removeRemoteFollow(undo.actorId.href, ctx.recipient);
      }
    })
    .on(Accept, async (ctx, accept) => {
      // Spec 4.4: a remote accepted our outgoing Follow — settle the
      // Pending row and trigger the first outbox poll for that actor.
      if (accept.actorId == null) return;
      if (await isBlockedIri(accept.actorId.href)) { federationInboxDroppedTotal.inc({ reason: "blocked" }); return; } // silent 202 drop
      if (accept.id != null && !(await markInboundActivityProcessed(accept.id.href)).fresh) { federationInboxDroppedTotal.inc({ reason: "duplicate" }); return; } // replay: drop
      // Capture the raw object reference BEFORE dereferencing:
      // getObject() memoizes the fetched document, after which objectId
      // reports the fetched object's id (fragment stripped) instead of
      // the id that was on the wire.
      const objectId = accept.objectId;
      const object = await accept.getObject(ctx);
      logger.debug(
        {
          recipient: ctx.recipient,
          objectId: objectId?.href ?? null,
          objectType: object?.constructor?.name ?? null,
        },
        "federation: Accept listener dispatch",
      );
      let localUser: Awaited<ReturnType<typeof findLocalPublicUserByIri>> = null;
      if (object instanceof Follow) {
        localUser = await findLocalPublicUserByIri(object.actorId);
      } else if (isRecipientFollowUri(ctx, objectId)) {
        // trails→trails: our own Follow id is cross-origin from the
        // accepting instance's perspective, so Fedify rightly distrusts
        // the embedded copy and a re-fetch of `…#follows/<id>` returns
        // our actor document instead of a Follow. The id itself names
        // this inbox's recipient, which is all settling needs — and
        // settleOutgoingFollow only matches a Pending row toward the
        // authenticated sender, so a forged Accept can't settle
        // anything that wasn't already directed at that actor.
        localUser = await findLocalPublicUserByIri(new URL(localActorIri(ctx.recipient!)));
      }
      if (!localUser) return;
      const { settled } = await settleOutgoingFollow(localUser.id, accept.actorId.href);
      if (settled) {
        await enqueueOptional("poll-remote-actor", { actorIri: accept.actorId.href }, {
          reason: "first poll after accepted follow",
        });
      }
    })
    .on(Reject, async (ctx, reject) => {
      // Spec 4.5: remote refused our Follow — drop the Pending row.
      if (reject.actorId == null) return;
      if (await isBlockedIri(reject.actorId.href)) { federationInboxDroppedTotal.inc({ reason: "blocked" }); return; } // silent 202 drop
      if (reject.id != null && !(await markInboundActivityProcessed(reject.id.href)).fresh) { federationInboxDroppedTotal.inc({ reason: "duplicate" }); return; } // replay: drop
      const objectId = reject.objectId; // capture before dereference (see Accept)
      const object = await reject.getObject(ctx);
      let localUser: Awaited<ReturnType<typeof findLocalPublicUserByIri>> = null;
      if (object instanceof Follow) {
        localUser = await findLocalPublicUserByIri(object.actorId);
      } else if (isRecipientFollowUri(ctx, objectId)) {
        // Same trails→trails fallback as the Accept listener above.
        localUser = await findLocalPublicUserByIri(new URL(localActorIri(ctx.recipient!)));
      }
      if (!localUser) return;
      await rejectOutgoingFollow(localUser.id, reject.actorId.href);
    })
    .onError(async (_ctx, error) => {
      logger.warn({ err: error }, "federation: inbox listener error");
    });

  // Dereferenceable Note objects: the Notes we emit (outbox + push
  // delivery) use /activities/{id} as their id, so that IRI must serve
  // the Note as activity+json. Mastodon's search-fetch of an activity
  // URL and strict instances that re-fetch pushed objects both rely on
  // this. Browsers keep getting HTML — the activities.$id route
  // middleware short-circuits AP requests here.
  federation.setObjectDispatcher(Note, "/activities/{id}", async (_ctx, values) => {
    const db = getDb();
    const [row] = await db
      .select()
      .from(activities)
      .where(and(eq(activities.id, values.id), eq(activities.visibility, "public")))
      .limit(1);
    // Remote-ingested activities are not our objects — only locally
    // authored rows dereference here (their canonical IRI is on the
    // origin instance).
    if (!row || row.ownerId === null) return null;
    const [owner] = await db
      .select({ username: users.username, profileVisibility: users.profileVisibility })
      .from(users)
      .where(eq(users.id, row.ownerId))
      .limit(1);
    // Private owners don't federate — their content 404s like their actor.
    if (!owner || owner.profileVisibility !== "public") return null;
    return activityToNote(row, owner.username);
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
