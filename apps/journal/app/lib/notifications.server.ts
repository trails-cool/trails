import { randomUUID } from "node:crypto";
import { and, count, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "./db.ts";
import { notifications } from "@trails-cool/db/schema/journal";
import type { NotificationType } from "@trails-cool/db/schema/journal";
import { emitTo } from "./events.server.ts";
import {
  PAYLOAD_VERSION,
  type ActivityPayloadV1,
  type ApprovalPayloadV1,
  type FollowPayloadV1,
} from "./notifications/payload.ts";

/**
 * Push the current unread count to all of `userId`'s open SSE
 * connections. Called after any state change that could affect the
 * count: createNotification (new row), markRead (one less unread),
 * markAllRead (zero unread).
 */
async function emitUnreadCount(userId: string): Promise<void> {
  const c = await countUnread(userId);
  emitTo(userId, "notifications.unread", { count: c });
}

// Discriminated union of (type, payload) so callers can't pass the
// wrong payload shape for a given event type. PAYLOAD_VERSION is set
// internally; callers don't pick a version.
type CreateInput =
  | { type: "follow_request_received"; recipientUserId: string; actorUserId: string | null; subjectId: string | null; payload: FollowPayloadV1 }
  | { type: "follow_received"; recipientUserId: string; actorUserId: string | null; subjectId: string | null; payload: FollowPayloadV1 }
  | { type: "follow_request_approved"; recipientUserId: string; actorUserId: string | null; subjectId: string | null; payload: ApprovalPayloadV1 }
  | { type: "activity_published"; recipientUserId: string; actorUserId: string | null; subjectId: string | null; payload: ActivityPayloadV1 };

/**
 * Create a notification. When `subjectId` is set, idempotent against
 * the partial unique index `(recipient_user_id, type, subject_id) WHERE
 * subject_id IS NOT NULL` so fan-out job retries can't double-insert.
 * When `subjectId` is null (1:1 follow events) idempotency is enforced
 * upstream by the follow hooks (they only emit on a *new* row), so a
 * plain insert is safe and avoids ON CONFLICT inference against a
 * partial index, which Postgres rejects.
 */
export async function createNotification(input: CreateInput): Promise<boolean> {
  const db = getDb();
  const values = {
    id: randomUUID(),
    recipientUserId: input.recipientUserId,
    type: input.type,
    actorUserId: input.actorUserId,
    subjectId: input.subjectId,
    payload: input.payload as unknown as Record<string, unknown>,
    payloadVersion: PAYLOAD_VERSION,
  };

  const result = input.subjectId
    ? await db
        .insert(notifications)
        .values(values)
        .onConflictDoNothing({
          target: [notifications.recipientUserId, notifications.type, notifications.subjectId],
          // Match the partial unique index's predicate so Postgres can
          // infer the arbiter index (`WHERE subject_id IS NOT NULL`).
          // `onConflictDoNothing` only exposes `where` (no targetWhere).
          where: sql`${notifications.subjectId} IS NOT NULL`,
        })
        .returning({ id: notifications.id })
    : await db.insert(notifications).values(values).returning({ id: notifications.id });

  if (result.length > 0) {
    // Push refreshed count to any open SSE connections for this
    // recipient. Emit happens after the row commits so the count
    // reflects reality.
    await emitUnreadCount(input.recipientUserId);
    return true;
  }
  return false;
}

export interface NotificationRow {
  id: string;
  type: NotificationType;
  actorUserId: string | null;
  subjectId: string | null;
  payload: Record<string, unknown> | null;
  payloadVersion: number;
  readAt: Date | null;
  createdAt: Date;
}

const PAGE_SIZE = 50;

export async function listForUser(
  userId: string,
  opts: { page?: number } = {},
): Promise<NotificationRow[]> {
  const db = getDb();
  const page = Math.max(1, opts.page ?? 1);
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      actorUserId: notifications.actorUserId,
      subjectId: notifications.subjectId,
      payload: notifications.payload,
      payloadVersion: notifications.payloadVersion,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.recipientUserId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return rows;
}

export async function countUnread(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        isNull(notifications.readAt),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Mark a single notification read. Owner-bound: only the recipient can
 * mark their own. Returns true on success, false if the row doesn't
 * exist or doesn't belong to the caller. Idempotent for already-read.
 */
export async function markRead(ownerId: string, id: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.recipientUserId, ownerId),
      ),
    )
    .returning({ id: notifications.id });
  if (result.length === 0) return false;
  await emitUnreadCount(ownerId);
  return true;
}

/**
 * Mark all of `ownerId`'s unread notifications read. Returns the
 * number of rows touched.
 */
export async function markAllRead(ownerId: string): Promise<number> {
  const db = getDb();
  const result = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientUserId, ownerId),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id });
  if (result.length > 0) await emitUnreadCount(ownerId);
  return result.length;
}

/**
 * Retention: drop read notifications older than `days`. Unread rows
 * survive indefinitely. Called by the daily pg-boss job.
 */
export async function purgeReadOlderThan(days: number): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await db
    .delete(notifications)
    .where(
      and(
        sql`${notifications.readAt} IS NOT NULL`,
        lt(notifications.readAt, cutoff),
      ),
    )
    .returning({ id: notifications.id });
  return result.length;
}
