// Outbound trails-to-trails follows (spec: social-federation §6).
//
// A local user follows a user on another *trails* instance: resolve the
// handle via WebFinger, verify the target instance runs trails.cool via
// NodeInfo (checked against the ACTOR IRI's host, never the handle's
// domain — remote instances may run split domains, see
// docs/ideas/split-domain-handles.md), record a Pending follow row, and
// deliver a signed Follow. The remote's Accept(Follow) settles the row
// (inbox listener from §4); Reject deletes it.
//
// Network-touching steps (actor lookup, NodeInfo fetch, delivery) are
// injectable so the row lifecycle is integration-testable offline.

import { randomUUID } from "node:crypto";
import { getNodeInfo } from "@fedify/fedify";
import { Follow, Undo } from "@fedify/fedify/vocab";
import { and, eq, isNull, isNotNull, desc } from "drizzle-orm";
import { users, follows, remoteActors } from "@trails-cool/db/schema/journal";
import { getDb } from "./db.ts";
import { getOrigin } from "./config.server.ts";
import { localActorIri } from "./actor-iri.ts";
import { getFederation } from "./federation.server.ts";
import { upsertRemoteActor } from "./federation-delivery.server.ts";
import { FollowError } from "./follow.server.ts";
import { logger } from "./logger.server.ts";

/**
 * Software names accepted by the trails-to-trails check. Forks that
 * keep the NodeInfo name federate out of the box; rebrands need a PR
 * here (see the open question in social-federation design.md; the
 * Wanderer-interop idea would extend this list).
 */
const TRAILS_SOFTWARE = new Set(["trails-cool"]);

export interface RemoteHandle {
  username: string;
  host: string;
}

/**
 * Parse `@user@host`, `user@host`, or an `acct:` URI into its parts.
 * Returns null for anything else (including bare usernames and URLs —
 * follows by URL can come later; handles are the user-facing shape).
 */
export function parseRemoteHandle(input: string): RemoteHandle | null {
  const trimmed = input.trim().replace(/^acct:/, "").replace(/^@/, "");
  const match = /^([a-z0-9_.-]+)@([a-z0-9.-]+\.[a-z]{2,}(?::\d+)?)$/i.exec(trimmed);
  if (!match) return null;
  return { username: match[1]!, host: match[2]!.toLowerCase() };
}

export function isTrailsSoftware(name: string | undefined): boolean {
  return name !== undefined && TRAILS_SOFTWARE.has(name);
}

export interface ResolvedRemoteActor {
  iri: string;
  inboxUrl: string;
  username: string | null;
  displayName: string | null;
}

export interface OutboundFollowDeps {
  resolveActor(handle: RemoteHandle): Promise<ResolvedRemoteActor | null>;
  fetchSoftwareName(actorIri: string): Promise<string | undefined>;
  deliverFollow(followerUsername: string, followId: string, target: ResolvedRemoteActor): Promise<void>;
  deliverUndoFollow(followerUsername: string, followId: string, target: { iri: string; inboxUrl: string }): Promise<void>;
}

function followActivityId(followerUsername: string, followId: string): URL {
  return new URL(`${localActorIri(followerUsername)}#follows/${followId}`);
}

function defaultDeps(): OutboundFollowDeps {
  const federation = getFederation();
  const ctx = () => federation.createContext(new URL(getOrigin()), undefined);
  return {
    async resolveActor(handle) {
      const actor = await ctx().lookupObject(`@${handle.username}@${handle.host}`);
      if (actor == null || !("inboxId" in actor) || actor.id == null) return null;
      const inbox = actor.inboxId as URL | null;
      if (inbox == null) return null;
      return {
        iri: actor.id.href,
        inboxUrl: inbox.href,
        username: ("preferredUsername" in actor ? (actor.preferredUsername as unknown as string | null) : null) ?? handle.username,
        displayName: ("name" in actor ? (actor.name as unknown as string | null) : null),
      };
    },
    async fetchSoftwareName(actorIri) {
      // Split-domain constraint: NodeInfo is looked up on the ACTOR
      // IRI's origin (the server domain), never the handle's domain.
      const info = await getNodeInfo(new URL(actorIri).origin);
      return info?.software?.name;
    },
    async deliverFollow(followerUsername, followId, target) {
      await ctx().sendActivity(
        { identifier: followerUsername },
        { id: new URL(target.iri), inboxId: new URL(target.inboxUrl) },
        new Follow({
          id: followActivityId(followerUsername, followId),
          actor: new URL(localActorIri(followerUsername)),
          object: new URL(target.iri),
        }),
      );
    },
    async deliverUndoFollow(followerUsername, followId, target) {
      await ctx().sendActivity(
        { identifier: followerUsername },
        { id: new URL(target.iri), inboxId: new URL(target.inboxUrl) },
        new Undo({
          id: new URL(`${localActorIri(followerUsername)}#follows/${followId}/undo`),
          actor: new URL(localActorIri(followerUsername)),
          object: new Follow({
            id: followActivityId(followerUsername, followId),
            actor: new URL(localActorIri(followerUsername)),
            object: new URL(target.iri),
          }),
        }),
      );
    },
  };
}

export interface OutgoingFollowState {
  pending: boolean;
  actorIri: string;
}

/**
 * Follow a user on another trails instance (spec 6.1/6.4). Pending
 * until their Accept(Follow) lands in our inbox. Idempotent: an
 * existing row (pending or accepted) is returned unchanged.
 */
export async function followRemoteActor(
  followerId: string,
  handleInput: string,
  deps: OutboundFollowDeps = defaultDeps(),
): Promise<OutgoingFollowState> {
  const handle = parseRemoteHandle(handleInput);
  if (!handle) {
    throw new FollowError("invalid_handle", "Enter a handle like @user@instance.example");
  }
  const ownHost = new URL(getOrigin()).host;
  if (handle.host === ownHost) {
    throw new FollowError("local_handle", "That user is on this instance — follow them from their profile");
  }

  const db = getDb();
  const [follower] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, followerId))
    .limit(1);
  if (!follower) throw new FollowError("user_not_found", "User not found");

  const actor = await deps.resolveActor(handle);
  if (!actor) {
    throw new FollowError("remote_resolve_failed", "Couldn't find that user — check the handle");
  }

  // Trails-to-trails gate (spec 6.1/6.3).
  let software: string | undefined;
  try {
    software = await deps.fetchSoftwareName(actor.iri);
  } catch {
    software = undefined;
  }
  if (!isTrailsSoftware(software)) {
    throw new FollowError(
      "not_trails",
      "Outbound federation is currently trails-to-trails only — that instance doesn't run trails.cool",
    );
  }

  // Idempotent re-follow.
  const [existing] = await db
    .select({ id: follows.id, acceptedAt: follows.acceptedAt })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followedActorIri, actor.iri)));
  if (existing) {
    return { pending: existing.acceptedAt === null, actorIri: actor.iri };
  }

  const followId = randomUUID();
  await db.insert(follows).values({
    id: followId,
    followerId,
    followedActorIri: actor.iri,
    followedUserId: null,
    acceptedAt: null,
  });
  await upsertRemoteActor({
    actorIri: actor.iri,
    inboxUrl: actor.inboxUrl,
    username: actor.username,
    displayName: actor.displayName,
    domain: new URL(actor.iri).host,
  });

  try {
    await deps.deliverFollow(follower.username, followId, actor);
  } catch (err) {
    // Keep the Pending row — Fedify's queue retries delivery; the row
    // is also the user's visible record that a request is in flight.
    logger.warn({ err, actorIri: actor.iri }, "outbound Follow delivery failed (queued retries may still succeed)");
  }

  logger.info({ followerId, actorIri: actor.iri }, "federation: outbound follow pending");
  return { pending: true, actorIri: actor.iri };
}

/**
 * Cancel an outgoing remote follow (pending or accepted): delete the
 * row and deliver Undo(Follow) (spec 6.6 / social-follows "Cancel a
 * Pending follow").
 */
export async function cancelRemoteFollow(
  followerId: string,
  actorIri: string,
  deps: OutboundFollowDeps = defaultDeps(),
): Promise<void> {
  const db = getDb();
  const [follower] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, followerId))
    .limit(1);
  if (!follower) throw new FollowError("user_not_found", "User not found");

  const deleted = await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followedActorIri, actorIri),
        isNull(follows.followedUserId), // remote rows only
      ),
    )
    .returning({ id: follows.id });
  if (deleted.length === 0) return; // idempotent

  const [cached] = await db
    .select({ inboxUrl: remoteActors.inboxUrl })
    .from(remoteActors)
    .where(eq(remoteActors.actorIri, actorIri))
    .limit(1);
  if (cached?.inboxUrl) {
    try {
      await deps.deliverUndoFollow(follower.username, deleted[0]!.id, {
        iri: actorIri,
        inboxUrl: cached.inboxUrl,
      });
    } catch (err) {
      logger.warn({ err, actorIri }, "Undo(Follow) delivery failed; row already removed locally");
    }
  }
  logger.info({ followerId, actorIri }, "federation: outbound follow cancelled");
}

export interface OutgoingFollowEntry {
  actorIri: string;
  pending: boolean;
  createdAt: Date;
  displayName: string | null;
  username: string | null;
  domain: string | null;
}

/** All outgoing remote follows for the user, newest first (spec 6.6). */
export async function listOutgoingRemoteFollows(followerId: string): Promise<OutgoingFollowEntry[]> {
  const db = getDb();
  const rows = await db
    .select({
      actorIri: follows.followedActorIri,
      acceptedAt: follows.acceptedAt,
      createdAt: follows.createdAt,
      displayName: remoteActors.displayName,
      username: remoteActors.username,
      domain: remoteActors.domain,
    })
    .from(follows)
    .leftJoin(remoteActors, eq(follows.followedActorIri, remoteActors.actorIri))
    .where(
      and(
        eq(follows.followerId, followerId),
        isNull(follows.followedUserId),
        isNotNull(follows.followedActorIri),
      ),
    )
    .orderBy(desc(follows.createdAt));
  return rows.map((r) => ({
    actorIri: r.actorIri,
    pending: r.acceptedAt === null,
    createdAt: r.createdAt,
    displayName: r.displayName,
    username: r.username,
    domain: r.domain,
  }));
}
