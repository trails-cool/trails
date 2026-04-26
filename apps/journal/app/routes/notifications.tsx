import { data, redirect, useFetcher } from "react-router";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { inArray, eq, and } from "drizzle-orm";
import type { Route } from "./+types/notifications";
import { getDb } from "~/lib/db";
import { getSessionUser } from "~/lib/auth.server";
import { listForUser } from "~/lib/notifications.server";
import { linkFor } from "~/lib/notifications/link-for";
import { readPayload } from "~/lib/notifications/payload";
import {
  countPendingFollowRequests,
  listPendingFollowRequests,
} from "~/lib/follow.server";
import { ClientDate } from "~/components/ClientDate";
import { activities } from "@trails-cool/db/schema/journal";

type Tab = "activity" | "requests";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");

  const url = new URL(request.url);
  const tab: Tab = url.searchParams.get("tab") === "requests" ? "requests" : "activity";

  // Pending count drives the Requests tab dot regardless of which tab is
  // currently active, so we always fetch it. It's a single COUNT(*) query.
  const pendingCount = await countPendingFollowRequests(user.id);

  if (tab === "requests") {
    const requests = await listPendingFollowRequests(user.id);
    return data({
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
    });
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

  return data({
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
  });
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Notifications — trails.cool" }];
}

interface NotificationRow {
  id: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  link: string;
  payload: Record<string, unknown> | null;
}

interface RequestRow {
  id: string;
  followerUsername: string;
  followerDisplayName: string | null;
  followerDomain: string;
  createdAt: string;
}

function summary(t: (key: string, opts?: Record<string, unknown>) => string, n: NotificationRow): string {
  const p = n.payload as { followerUsername?: string; followerDisplayName?: string | null;
    targetUsername?: string; targetDisplayName?: string | null;
    activityName?: string; ownerUsername?: string; ownerDisplayName?: string | null } | null;
  const someone = t("notifications.someone");
  switch (n.type) {
    case "follow_request_received": {
      const name = p?.followerDisplayName ?? p?.followerUsername ?? someone;
      return t("notifications.summary.followRequestReceived", { name });
    }
    case "follow_received": {
      const name = p?.followerDisplayName ?? p?.followerUsername ?? someone;
      return t("notifications.summary.followReceived", { name });
    }
    case "follow_request_approved": {
      const name = p?.targetDisplayName ?? p?.targetUsername ?? someone;
      return t("notifications.summary.followRequestApproved", { name });
    }
    case "activity_published": {
      const owner = p?.ownerDisplayName ?? p?.ownerUsername ?? someone;
      const activity = p?.activityName ?? "";
      return t("notifications.summary.activityPublished", { owner, activity });
    }
    default:
      return n.type;
  }
}

function NotificationItem({ row }: { row: NotificationRow }) {
  const { t } = useTranslation("journal");
  const fetcher = useFetcher();
  const inFlight = fetcher.state !== "idle";

  const onClick = (e: React.MouseEvent) => {
    if (row.readAt) return; // already read; let the link navigate normally
    // Mark read in the background; navigation proceeds via the anchor.
    fetcher.submit(null, {
      method: "post",
      action: `/api/notifications/${row.id}/read`,
    });
    void e;
  };

  return (
    <li
      className={
        row.readAt
          ? "border-b border-gray-100 px-4 py-3"
          : "border-b border-blue-100 bg-blue-50 px-4 py-3"
      }
    >
      <a href={row.link} onClick={onClick} className="block hover:underline">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm text-gray-900">
            {!row.readAt && (
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
            )}
            {summary(t, row)}
          </div>
          <span className="shrink-0 text-xs text-gray-400">
            <ClientDate iso={row.createdAt} withTime />
          </span>
        </div>
      </a>
      {inFlight && <span className="sr-only">marking read</span>}
    </li>
  );
}

function RequestItem({ row }: { row: RequestRow }) {
  const { t } = useTranslation("journal");
  const approve = useFetcher();
  const reject = useFetcher();
  const inFlight = approve.state !== "idle" || reject.state !== "idle";

  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div>
        <a
          href={`/users/${row.followerUsername}`}
          className="text-sm font-medium text-gray-900 hover:underline"
        >
          {row.followerDisplayName ?? row.followerUsername}
        </a>
        <p className="text-xs text-gray-500">
          @{row.followerUsername}@{row.followerDomain} ·{" "}
          <ClientDate iso={row.createdAt} />
        </p>
      </div>
      <div className="flex gap-2">
        <reject.Form method="post" action={`/api/follows/${row.id}/reject`}>
          <button
            type="submit"
            disabled={inFlight}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("social.requests.reject")}
          </button>
        </reject.Form>
        <approve.Form method="post" action={`/api/follows/${row.id}/approve`}>
          <button
            type="submit"
            disabled={inFlight}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {t("social.requests.approve")}
          </button>
        </approve.Form>
      </div>
    </li>
  );
}

function TabLink({
  to,
  active,
  label,
  badge,
}: {
  to: string;
  active: boolean;
  label: string;
  badge: number;
}) {
  return (
    <Link
      to={to}
      className={`relative -mb-px inline-flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium ${
        active
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-600 hover:text-gray-900"
      }`}
    >
      {label}
      {badge > 0 && (
        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function Notifications({ loaderData }: Route.ComponentProps) {
  const { tab, pendingCount, notifications, nextCursor, requests } = loaderData;
  const { t } = useTranslation("journal");
  const markAll = useFetcher();

  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("notifications.title")}</h1>
        {tab === "activity" && hasUnread && (
          <markAll.Form method="post" action="/api/notifications/read-all">
            <button
              type="submit"
              disabled={markAll.state !== "idle"}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t("notifications.markAllRead")}
            </button>
          </markAll.Form>
        )}
      </div>

      <div className="mt-4 flex gap-6 border-b border-gray-200">
        <TabLink
          to="/notifications"
          active={tab === "activity"}
          label={t("notifications.tabs.activity")}
          badge={0}
        />
        <TabLink
          to="/notifications?tab=requests"
          active={tab === "requests"}
          label={t("notifications.tabs.requests")}
          badge={pendingCount}
        />
      </div>

      {tab === "activity" ? (
        notifications.length === 0 ? (
          <p className="mt-12 text-center text-gray-500">{t("notifications.empty")}</p>
        ) : (
          <>
            <ul className="mt-6 rounded-lg border border-gray-200 bg-white">
              {notifications.map((n) => (
                <NotificationItem key={n.id} row={n} />
              ))}
            </ul>
            {nextCursor && (
              <div className="mt-4 text-center">
                <a
                  href={`/notifications?before=${encodeURIComponent(nextCursor)}`}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  {t("notifications.loadOlder")}
                </a>
              </div>
            )}
          </>
        )
      ) : requests.length === 0 ? (
        <p className="mt-12 text-center text-gray-500">{t("social.requests.empty")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {requests.map((r) => (
            <RequestItem key={r.id} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
