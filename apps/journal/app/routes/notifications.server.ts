// Server-only loader for /notifications. See `home.server.ts`.

import { redirect } from "react-router";
import { inArray, eq, and } from "drizzle-orm";
import { getDb } from "~/lib/db";
import { getSessionUser } from "~/lib/auth/session.server";
import { listForUser } from "~/lib/notifications.server";
import { linkFor } from "~/lib/notifications/link-for";
import { readPayload } from "~/lib/notifications/payload";
import {
  countPendingFollowRequests,
  listPendingFollowRequests,
} from "~/lib/follow.server";
import { activities } from "@trails-cool/db/schema/journal";

type Tab = "activity" | "requests";

export interface NotificationRow {
  id: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  link: string;
  payload: Record<string, unknown> | null;
}

export interface RequestRow {
  id: string;
  followerUsername: string;
  followerDisplayName: string | null;
  followerDomain: string;
  createdAt: string;
}

export async function loadNotifications(request: Request) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");

  const url = new URL(request.url);
  const tab: Tab = url.searchParams.get("tab") === "requests" ? "requests" : "activity";

  // Pending count drives the Requests tab dot regardless of which tab is
  // currently active, so we always fetch it. It's a single COUNT(*) query.
  const pendingCount = await countPendingFollowRequests(user.id);

  if (tab === "requests") {
    const requests = await listPendingFollowRequests(user.id);
    return {
      tab: "requests" as const,
      pendingCount,
      requests: requests.map((r) => ({
        id: r.id,
        followerUsername: r.followerUsername,
        followerDisplayName: r.followerDisplayName,
        followerDomain: r.followerDomain,
        createdAt: r.createdAt.toISOString(),
      })),
      notifications: [] as NotificationRow[],
      nextCursor: null as string | null,
    };
  }

  const before = url.searchParams.get("before") ?? undefined;
  const { rows, nextCursor } = await listForUser(user.id, { before });

  // Renderer guard: drop activity_published rows whose subject is gone
  // or no longer public (visibility flipped from public → private/unlisted).
  // Fetch the still-public subject IDs in one query, then filter.
  const activitySubjectIds = rows
    .filter((r) => r.type === "activity_published" && r.subjectId)
    .map((r) => r.subjectId as string);
  let publicActivityIds = new Set<string>();
  if (activitySubjectIds.length > 0) {
    const db = getDb();
    const visible = await db
      .select({ id: activities.id })
      .from(activities)
      .where(and(inArray(activities.id, activitySubjectIds), eq(activities.visibility, "public")));
    publicActivityIds = new Set(visible.map((v) => v.id));
  }

  const visibleRows = rows.filter((r) => {
    if (r.type !== "activity_published") return true;
    if (!r.subjectId) return false;
    return publicActivityIds.has(r.subjectId);
  });

  return {
    tab: "activity" as const,
    pendingCount,
    requests: [] as RequestRow[],
    notifications: visibleRows.map((r) => {
      const link = linkFor({
        type: r.type,
        subjectId: r.subjectId,
        payload: r.payload,
        payloadVersion: r.payloadVersion,
      });
      const payload = readPayload(r.type, r.payloadVersion, r.payload);
      return {
        id: r.id,
        type: r.type,
        readAt: r.readAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        link: link.web,
        payload,
      };
    }),
    nextCursor,
  };
}
