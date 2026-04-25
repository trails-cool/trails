import type { JobDefinition } from "@trails-cool/jobs";
import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../lib/db.ts";
import { activities, follows, users } from "@trails-cool/db/schema/journal";
import { createNotification } from "../lib/notifications.server.ts";
import { logger } from "../lib/logger.server.ts";

interface FanoutData {
  activityId: string;
}

/**
 * Fan out an `activity_published` notification to every accepted
 * follower of the activity's owner. Idempotent at the DB level via the
 * `(recipient_user_id, type, subject_id)` unique partial index — a
 * retry after partial failure won't double-insert.
 */
export const notificationsFanoutJob: JobDefinition = {
  name: "notifications-fanout",
  retryLimit: 3,
  expireInSeconds: 300,
  async handler(job) {
    // pg-boss v12: `job` may be an array (batch) per its docs; we
    // process whichever shape we get.
    const batch = Array.isArray(job) ? job : [job];
    for (const item of batch) {
      const data = item.data as FanoutData;
      await fanout(data.activityId);
    }
  },
};

export async function fanout(activityId: string): Promise<void> {
  const db = getDb();

  // Load the activity + owner info needed for the payload snapshot.
  const [row] = await db
    .select({
      id: activities.id,
      name: activities.name,
      visibility: activities.visibility,
      ownerId: activities.ownerId,
      ownerUsername: users.username,
      ownerDisplayName: users.displayName,
    })
    .from(activities)
    .innerJoin(users, eq(activities.ownerId, users.id))
    .where(eq(activities.id, activityId));

  if (!row) {
    logger.warn({ activityId }, "fanout: activity not found, skipping");
    return;
  }
  // Defense in depth — the create-side guard already filters this, but
  // recheck here so the job doesn't mistakenly fan out a row that was
  // later flipped to private/unlisted before the job ran.
  if (row.visibility !== "public") {
    logger.info({ activityId, visibility: row.visibility }, "fanout: skipping non-public activity");
    return;
  }

  // Find every accepted follower of the owner.
  const recipients = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(
      and(
        eq(follows.followedUserId, row.ownerId),
        isNotNull(follows.acceptedAt),
      ),
    );

  let inserted = 0;
  for (const r of recipients) {
    // Don't notify the owner about their own activity if they happen
    // to follow themselves (shouldn't happen — followUser refuses
    // self-follow — but defense in depth).
    if (r.followerId === row.ownerId) continue;
    const created = await createNotification({
      type: "activity_published",
      recipientUserId: r.followerId,
      actorUserId: row.ownerId,
      subjectId: row.id,
      payload: {
        activityId: row.id,
        activityName: row.name,
        ownerUsername: row.ownerUsername,
        ownerDisplayName: row.ownerDisplayName,
      },
    });
    if (created) inserted += 1;
  }

  logger.info(
    { activityId, recipients: recipients.length, inserted },
    "notifications-fanout completed",
  );
}
