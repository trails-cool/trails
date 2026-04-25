import { data, redirect, useFetcher } from "react-router";
import { useTranslation } from "react-i18next";
import { inArray, eq, and } from "drizzle-orm";
import type { Route } from "./+types/notifications";
import { getDb } from "~/lib/db";
import { getSessionUser } from "~/lib/auth.server";
import { listForUser } from "~/lib/notifications.server";
import { linkFor } from "~/lib/notifications/link-for";
import { readPayload } from "~/lib/notifications/payload";
import { ClientDate } from "~/components/ClientDate";
import { activities } from "@trails-cool/db/schema/journal";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");

  const rows = await listForUser(user.id, { page: 1 });

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
  });
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Notifications — trails.cool" }];
}

interface Row {
  id: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  link: string;
  payload: Record<string, unknown> | null;
}

function summary(t: (key: string, opts?: Record<string, unknown>) => string, n: Row): string {
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

function NotificationItem({ row }: { row: Row }) {
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
    // The anchor href takes over the navigation; we don't preventDefault
    // unless the request fails — and even if it does, the user can mark
    // read manually from the page next time.
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

export default function Notifications({ loaderData }: Route.ComponentProps) {
  const { notifications } = loaderData;
  const { t } = useTranslation("journal");
  const markAll = useFetcher();

  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("notifications.title")}</h1>
        {hasUnread && (
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

      {notifications.length === 0 ? (
        <p className="mt-12 text-center text-gray-500">{t("notifications.empty")}</p>
      ) : (
        <ul className="mt-6 rounded-lg border border-gray-200 bg-white">
          {notifications.map((n) => (
            <NotificationItem key={n.id} row={n} />
          ))}
        </ul>
      )}
    </div>
  );
}
