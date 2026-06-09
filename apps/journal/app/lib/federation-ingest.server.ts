// Outbox-poll ingestion of remote trails activities (spec:
// social-federation §7). We are the poller: signed GETs (Authorized
// Fetch) against the outboxes of remote trails actors that local users
// follow, storing new activities for feed display. The wire shape is
// our own outbox format (trails-to-trails only), so parsing targets
// exactly what federation-objects.server.ts emits: Create activities
// wrapping Notes with PropertyValue stat attachments.
//
// Network steps are injectable for offline integration tests.

import { FetchError } from "@fedify/fedify";
import { and, eq, isNull, isNotNull, lt, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { activities, follows, remoteActors, users } from "@trails-cool/db/schema/journal";
import { getDb } from "./db.ts";
import { getOrigin } from "./config.server.ts";
import { getFederation } from "./federation.server.ts";
import { upsertRemoteActor } from "./federation-delivery.server.ts";
import { logger } from "./logger.server.ts";

/** Spec: fetch at most the 50 most recent items per remote actor. */
const MAX_ITEMS_PER_POLL = 50;
/** Spec: skip actors polled within the last hour (cron sweep). */
const POLL_INTERVAL_MS = 60 * 60 * 1000;
/** Spec: per-remote-host pacing of 1 request / 5 seconds. */
const HOST_PACE_MS = 5_000;
/** Stop early after this many consecutive already-seen items (7.2). */
const CONFLICT_STREAK_LIMIT = 5;
/** Backoff after a 429 without a usable Retry-After (7.4). */
const DEFAULT_BACKOFF_MS = 15 * 60 * 1000;
/**
 * Cap an honored Retry-After at the poll interval — anything longer is
 * equivalent to "skip until a later sweep", and an absurd header from
 * a misbehaving remote shouldn't park a host for days.
 */
const MAX_BACKOFF_MS = POLL_INTERVAL_MS;

export interface ParsedRemoteActivity {
  originIri: string;
  name: string;
  distance: number | null;
  elevationGain: number | null;
  duration: number | null;
  publishedAt: Date | null;
  audience: "public" | "followers-only";
}

function isPublicAudience(value: unknown): boolean {
  const targets = Array.isArray(value) ? value : value == null ? [] : [value];
  return targets.some(
    (t) =>
      t === "https://www.w3.org/ns/activitystreams#Public" ||
      t === "as:Public" ||
      t === "Public",
  );
}

function textOfFirstParagraph(html: string): string {
  const match = /<p>([\s\S]*?)<\/p>/.exec(html);
  const raw = match?.[1] ?? html;
  return raw.replace(/<[^>]+>/g, "").trim();
}

function statFromAttachments(attachments: unknown, name: string): number | null {
  const list = Array.isArray(attachments) ? attachments : attachments == null ? [] : [attachments];
  for (const a of list) {
    if (
      typeof a === "object" && a !== null &&
      (a as Record<string, unknown>).type === "PropertyValue" &&
      (a as Record<string, unknown>).name === name
    ) {
      const v = Number.parseFloat(String((a as Record<string, unknown>).value));
      return Number.isFinite(v) ? v : null;
    }
  }
  return null;
}

/**
 * Parse one outbox item (a `Create` wrapping a `Note` in our own
 * outgoing shape) into an ingestable activity. Returns null for
 * anything that doesn't match — unknown items are skipped, never
 * fatal (forward compatibility with future trails versions).
 */
export function parseOutboxItem(item: unknown): ParsedRemoteActivity | null {
  if (typeof item !== "object" || item === null) return null;
  const create = item as Record<string, unknown>;
  if (create.type !== "Create") return null;
  const note = create.object;
  if (typeof note !== "object" || note === null) return null;
  const n = note as Record<string, unknown>;
  if (n.type !== "Note" || typeof n.id !== "string") return null;

  const content = typeof n.content === "string" ? n.content : "";
  const name = textOfFirstParagraph(content);
  if (!name) return null;

  const publishedRaw = typeof n.published === "string" ? n.published : typeof create.published === "string" ? create.published : null;
  const published = publishedRaw ? new Date(publishedRaw) : null;

  return {
    originIri: n.id,
    name: name.slice(0, 300),
    distance: statFromAttachments(n.attachment, "distance-m"),
    elevationGain: statFromAttachments(n.attachment, "elevation-gain-m"),
    duration: statFromAttachments(n.attachment, "duration-s"),
    publishedAt: published && !Number.isNaN(published.getTime()) ? published : null,
    audience: isPublicAudience(n.to) || isPublicAudience(n.cc) ? "public" : "followers-only",
  };
}

/**
 * Insert parsed activities for a remote actor. Replay-safe via the
 * unique remote_origin_iri (`ON CONFLICT DO NOTHING`); stops early on
 * a streak of already-seen items since outboxes are newest-first.
 * Returns the number of newly inserted rows.
 */
export async function ingestRemoteActivities(
  actorIri: string,
  items: ParsedRemoteActivity[],
): Promise<number> {
  const db = getDb();
  let inserted = 0;
  let conflictStreak = 0;
  for (const item of items) {
    const rows = await db
      .insert(activities)
      .values({
        id: randomUUID(),
        ownerId: null,
        name: item.name,
        description: "",
        distance: item.distance,
        elevationGain: item.elevationGain,
        duration: item.duration,
        // Mirror the audience into visibility for coherence with
        // local rows; the §8 feed query gates remote rows on audience
        // + follow, and every other surface joins users on owner_id,
        // which excludes remote rows structurally.
        visibility: item.audience === "public" ? "public" : "private",
        remoteOriginIri: item.originIri,
        remoteActorIri: actorIri,
        remotePublishedAt: item.publishedAt,
        audience: item.audience,
      })
      .onConflictDoNothing({ target: activities.remoteOriginIri })
      .returning({ id: activities.id });
    if (rows.length === 0) {
      conflictStreak++;
      if (conflictStreak >= CONFLICT_STREAK_LIMIT) break;
    } else {
      conflictStreak = 0;
      inserted++;
    }
  }
  return inserted;
}

export interface PollDeps {
  /**
   * Fetch a JSON document with an HTTP Signature from `signerUsername`
   * (Authorized Fetch — spec: "Polls are signed").
   */
  fetchJson(url: string, signerUsername: string): Promise<unknown>;
  /** Per-host pacing (spec 7.4: 1 req / 5 s). No-op in tests. */
  pace(host: string): Promise<void>;
}

const lastFetchPerHost = new Map<string, number>();

// 7.4: hosts that answered 429 are skipped until their backoff expires.
// In-process state, like the pacing map above — a restart forgets it,
// which is fine: the worst case is one extra request that gets another
// 429 and re-arms the backoff.
const hostBackoffUntil = new Map<string, number>();

/**
 * Parse a Retry-After header value (RFC 9110: delta-seconds or an
 * HTTP-date) into a millisecond delay from `now`. Null if absent or
 * unparseable.
 */
export function parseRetryAfter(value: string | null, now: number): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  // Bare integers are delta-seconds; negative ones are invalid (and
  // must not fall through to Date.parse, which reads them as years).
  if (/^-?\d+$/.test(trimmed)) {
    return /^\d+$/.test(trimmed) ? Number(trimmed) * 1000 : null;
  }
  const date = Date.parse(trimmed);
  if (!Number.isNaN(date)) return Math.max(0, date - now);
  return null;
}

/**
 * Record a 429 from `host`: back off for the remote's Retry-After
 * (capped) or a default. Returns the applied delay in ms.
 */
export function noteHostRateLimited(
  host: string,
  retryAfter: string | null,
  now = Date.now(),
): number {
  const delay = Math.min(parseRetryAfter(retryAfter, now) ?? DEFAULT_BACKOFF_MS, MAX_BACKOFF_MS);
  hostBackoffUntil.set(host, now + delay);
  return delay;
}

/** Whether `host` is inside a 429 backoff window. */
export function isHostBackingOff(host: string, now = Date.now()): boolean {
  const until = hostBackoffUntil.get(host) ?? 0;
  if (until <= now) {
    hostBackoffUntil.delete(host);
    return false;
  }
  return true;
}

/** Test hook: forget all 429 backoff state. */
export function resetHostBackoff(): void {
  hostBackoffUntil.clear();
}

function defaultDeps(): PollDeps {
  return {
    async fetchJson(url, signerUsername) {
      const federation = getFederation();
      const ctx = federation.createContext(new URL(getOrigin()), undefined);
      const loader = await ctx.getDocumentLoader({ identifier: signerUsername });
      const { document } = await loader(url);
      return document;
    },
    async pace(host) {
      const last = lastFetchPerHost.get(host) ?? 0;
      const wait = last + HOST_PACE_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastFetchPerHost.set(host, Date.now());
    },
  };
}

/**
 * Poll one remote actor's outbox and ingest new activities (7.2/7.3).
 * Returns counts for logging. Honors per-host pacing; a 429/Retry-After
 * from the remote aborts this poll quietly (the hourly sweep retries).
 */
export async function pollRemoteActor(
  actorIri: string,
  deps: PollDeps = defaultDeps(),
): Promise<{ inserted: number } | { skipped: string }> {
  // 7.4: respect an active 429 backoff before doing any work.
  const host = new URL(actorIri).host;
  if (isHostBackingOff(host)) return { skipped: "host rate-limited (backing off)" };

  const db = getDb();

  // Signer: any local user with an accepted follow against this actor.
  const [signer] = await db
    .select({ username: users.username })
    .from(follows)
    .innerJoin(users, eq(follows.followerId, users.id))
    .where(
      and(
        eq(follows.followedActorIri, actorIri),
        isNotNull(follows.acceptedAt),
        isNull(follows.followedUserId),
      ),
    )
    .limit(1);
  if (!signer) return { skipped: "no accepted local follower" };

  try {
    await deps.pace(host);

    // Resolve the outbox URL: cache first, actor document as fallback
    // (which also refreshes the cache — 7.3).
    const [cached] = await db
      .select({ outboxUrl: remoteActors.outboxUrl })
      .from(remoteActors)
      .where(eq(remoteActors.actorIri, actorIri))
      .limit(1);
    let outboxUrl = cached?.outboxUrl ?? null;
    if (!outboxUrl) {
      const actorDoc = (await deps.fetchJson(actorIri, signer.username)) as Record<string, unknown> | null;
      outboxUrl = typeof actorDoc?.outbox === "string" ? actorDoc.outbox : null;
      if (!outboxUrl) return { skipped: "actor has no outbox" };
      await upsertRemoteActor({
        actorIri,
        outboxUrl,
        displayName: typeof actorDoc?.name === "string" ? actorDoc.name : null,
        username: typeof actorDoc?.preferredUsername === "string" ? actorDoc.preferredUsername : null,
        inboxUrl: typeof actorDoc?.inbox === "string" ? actorDoc.inbox : undefined,
        domain: host,
      });
    }

    // Collection → first page (our outbox serves first=...?cursor=0).
    await deps.pace(host);
    const collection = (await deps.fetchJson(outboxUrl, signer.username)) as Record<string, unknown>;
    let itemsRaw = collection.orderedItems ?? collection.items;
    if (!itemsRaw && typeof collection.first === "string") {
      await deps.pace(host);
      const page = (await deps.fetchJson(collection.first, signer.username)) as Record<string, unknown>;
      itemsRaw = page.orderedItems ?? page.items;
    }
    const items = (Array.isArray(itemsRaw) ? itemsRaw : itemsRaw == null ? [] : [itemsRaw])
      .slice(0, MAX_ITEMS_PER_POLL)
      .map(parseOutboxItem)
      .filter((p): p is ParsedRemoteActivity => p !== null);

    const inserted = await ingestRemoteActivities(actorIri, items);
    await db
      .update(remoteActors)
      .set({ lastPolledAt: new Date() })
      .where(eq(remoteActors.actorIri, actorIri));
    logger.info({ actorIri, fetched: items.length, inserted }, "federation: outbox poll");
    return { inserted };
  } catch (err) {
    // 429: honor Retry-After (or default) and skip the host until the
    // backoff expires (7.4).
    if (err instanceof FetchError && err.response?.status === 429) {
      const delayMs = noteHostRateLimited(host, err.response.headers.get("retry-after"));
      logger.warn({ actorIri, host, delayMs }, "federation: remote rate-limited poll; backing off host");
      return { skipped: "rate limited" };
    }
    // Other network failures: log and let the hourly sweep retry.
    logger.warn({ err, actorIri }, "federation: outbox poll failed; will retry on next sweep");
    return { skipped: "fetch failed" };
  }
}

/**
 * Remote actor IRIs due for polling (7.1): followed-and-accepted by at
 * least one local user, never polled or polled more than an hour ago.
 */
export async function listActorsDuePolling(): Promise<string[]> {
  const db = getDb();
  const cutoff = new Date(Date.now() - POLL_INTERVAL_MS);
  const rows = await db
    .selectDistinct({ actorIri: follows.followedActorIri })
    .from(follows)
    .leftJoin(remoteActors, eq(follows.followedActorIri, remoteActors.actorIri))
    .where(
      and(
        isNull(follows.followedUserId),
        isNotNull(follows.acceptedAt),
        or(sql`${remoteActors.lastPolledAt} IS NULL`, lt(remoteActors.lastPolledAt, cutoff)),
      ),
    );
  return rows.map((r) => r.actorIri);
}
