import { useState, useCallback } from "react";
import { data, redirect } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/routes.$id";
import { and, eq } from "drizzle-orm";
import { canView } from "~/lib/auth.server";
import { getSessionUser } from "~/lib/auth/session.server";
import { getRoute, getRouteWithVersions, deleteRoute, updateRoute } from "~/lib/routes.server";
import { getDb } from "~/lib/db";
import { syncPushes } from "@trails-cool/db/schema/journal";
import { getService } from "~/lib/connected-services";
import { ClientDate } from "~/components/ClientDate";
import { ClientMap } from "~/components/ClientMap";


export async function loader({ params, request }: Route.LoaderArgs) {
  const [routeWithVersions, routeWithGeojson] = await Promise.all([
    getRouteWithVersions(params.id),
    getRoute(params.id),
  ]);
  if (!routeWithVersions) throw data({ error: "Route not found" }, { status: 404 });
  const route = routeWithVersions;

  const user = await getSessionUser(request);
  const isOwner = user?.id === route.ownerId;

  // Visibility gate: public always renders, unlisted renders on direct link,
  // private requires ownership. Return 404 (not 403) to avoid leaking existence.
  if (!canView(route, user, { asDirectLink: true })) {
    throw data({ error: "Route not found" }, { status: 404 });
  }

  // Parse GPX once for day stats and waypoint POI data
  let dayStats: Array<{ dayNumber: number; startName?: string; endName?: string; distance: number; ascent: number; descent: number }> = [];
  let waypoints: Array<{ lat: number; lon: number; name?: string; isDayBreak?: boolean; note?: string; osmId?: number; poiTags?: Record<string, string> }> = [];
  if (route.gpx) {
    try {
      const { computeDays, parseGpxAsync } = await import("@trails-cool/gpx");
      const gpxData = await parseGpxAsync(route.gpx);
      waypoints = gpxData.waypoints.map((w) => ({
        lat: w.lat,
        lon: w.lon,
        name: w.name,
        isDayBreak: w.isDayBreak,
        note: w.note,
        osmId: w.osmId,
        poiTags: w.poiTags as Record<string, string> | undefined,
      }));
      if (route.dayBreaks && route.dayBreaks.length > 0) {
        dayStats = computeDays(gpxData.waypoints, gpxData.tracks);
      }
    } catch {
      // Fall back to empty
    }
  }

  const currentVersion = route.versions[0]?.version ?? 1;

  // Wahoo push state — only meaningful for the owner. The single
  // sync_pushes row per (user, route, wahoo) carries `lastPushedVersion`,
  // which we compare against the current local version to render one of
  // three states: matches, local newer, or last attempt failed.
  let wahooPush:
    | {
        canPush: boolean;
        needsReauth: boolean;
        currentVersion: number;
        latest: {
          pushedAt: string | null;
          remoteId: string | null;
          lastPushedVersion: number | null;
          error: string | null;
        } | null;
      }
    | null = null;
  if (isOwner && user && !!route.gpx) {
    const connection = await getService(user.id, "wahoo");
    let latest:
      | {
          pushedAt: string | null;
          remoteId: string | null;
          lastPushedVersion: number | null;
          error: string | null;
        }
      | null = null;
    if (connection) {
      const db = getDb();
      const [row] = await db
        .select()
        .from(syncPushes)
        .where(
          and(
            eq(syncPushes.userId, user.id),
            eq(syncPushes.routeId, route.id),
            eq(syncPushes.provider, "wahoo"),
          ),
        )
        .limit(1);
      latest = row
        ? {
            pushedAt: row.pushedAt ? row.pushedAt.toISOString() : null,
            remoteId: row.remoteId,
            lastPushedVersion: row.lastPushedVersion,
            error: row.error,
          }
        : null;
    }
    wahooPush = {
      canPush: !!connection,
      needsReauth: !!connection && !connection.grantedScopes.includes("routes_write"),
      currentVersion,
      latest,
    };
  }

  return data({
    route: {
      id: route.id,
      name: route.name,
      description: route.description,
      distance: route.distance,
      elevationGain: route.elevationGain,
      elevationLoss: route.elevationLoss,
      routingProfile: route.routingProfile,
      hasGpx: !!route.gpx,
      dayBreaks: route.dayBreaks ?? [],
      geojson: routeWithGeojson?.geojson ?? null,
      visibility: route.visibility,
      createdAt: route.createdAt.toISOString(),
      updatedAt: route.updatedAt.toISOString(),
    },
    dayStats,
    waypoints,
    versions: route.versions.map((v) => ({
      version: v.version,
      changeDescription: v.changeDescription,
      createdAt: v.createdAt.toISOString(),
    })),
    isOwner,
    wahooPush,
  });
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    await deleteRoute(params.id, user.id);
    return redirect("/routes");
  }

  if (intent === "update") {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const gpxFile = formData.get("gpx") as File | null;

    const input: Record<string, unknown> = {};
    if (name) input.name = name;
    if (description !== null) input.description = description;
    if (gpxFile && gpxFile.size > 0) {
      input.gpx = await gpxFile.text();
    }

    await updateRoute(params.id, user.id, input as { name?: string; description?: string; gpx?: string });
    return redirect(`/routes/${params.id}`);
  }

  return data({ error: "Unknown action" }, { status: 400 });
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  const route = (loaderData as { route?: { name: string; description: string | null; visibility: string } })?.route;
  const name = route?.name ?? "Route";
  const title = `${name} — trails.cool`;
  const tags: Array<Record<string, string>> = [{ title }];

  // Only emit Open Graph / Twitter Card tags for publicly-reachable content.
  // Private routes are gated before meta is even called, but belt-and-braces.
  if (route && (route.visibility === "public" || route.visibility === "unlisted")) {
    const description = (route.description && route.description.length > 0)
      ? route.description.slice(0, 280)
      : `A route on trails.cool`;
    tags.push(
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:site_name", content: "trails.cool" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    );
  }

  return tags;
}

export default function RouteDetailPage({ loaderData }: Route.ComponentProps) {
  const { route, dayStats, waypoints, versions, isOwner, wahooPush } = loaderData;
  const { t, i18n } = useTranslation("journal");
  const [editLoading, setEditLoading] = useState(false);
  const [highlightedDay, setHighlightedDay] = useState<number | null>(null);

  const pushStatus = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("push")
    : null;
  const pushErrorCode = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("code")
    : null;

  // A route is "empty" when it has no geometry and no computed distance —
  // i.e. nobody has planned any waypoints yet. Surfaced as a dedicated
  // empty-state below so the page isn't a dead end.
  const isEmpty = !route.geojson && route.distance == null;

  const handleEditInPlanner = useCallback(async () => {
    setEditLoading(true);
    try {
      const resp = await fetch(`/api/routes/${route.id}/edit-in-planner`, { method: "POST" });
      const result = await resp.json();
      if (result.url) {
        window.location.href = result.url;
      }
    } finally {
      setEditLoading(false);
    }
  }, [route.id]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{route.name}</h1>
          {route.description && (
            <p className="mt-2 text-gray-600">{route.description}</p>
          )}
        </div>
        {isOwner && !isEmpty && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleEditInPlanner}
              disabled={editLoading}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {editLoading ? t("routes.opening") : t("routes.editInPlanner")}
            </button>
            <a
              href={`/routes/${route.id}/edit`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t("routes.edit")}
            </a>
            {route.hasGpx && (
              <a
                href={`/api/routes/${route.id}/gpx`}
                download
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                {t("routes.exportGpx")}
              </a>
            )}
            {wahooPush?.canPush && (() => {
              const latest = wahooPush.latest;
              const matches =
                latest?.pushedAt &&
                latest.lastPushedVersion === wahooPush.currentVersion;
              const localNewer =
                latest?.pushedAt &&
                latest.lastPushedVersion != null &&
                latest.lastPushedVersion < wahooPush.currentVersion;
              if (matches) {
                return (
                  <span
                    className="rounded-md bg-green-50 px-3 py-1.5 text-sm text-green-800"
                    title={t("routes.sendToWahooHelp")}
                  >
                    {t("routes.sentToWahoo", {
                      date: new Date(latest!.pushedAt!).toLocaleDateString(i18n.language),
                    })}
                  </span>
                );
              }
              return (
                <form method="post" action={`/api/sync/push/wahoo/${route.id}`} className="inline">
                  {localNewer && (
                    <span className="mr-2 rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
                      {t("routes.onWahooNewer", { n: latest!.lastPushedVersion })}
                    </span>
                  )}
                  <button
                    type="submit"
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    title={t("routes.sendToWahooHelp")}
                  >
                    {localNewer ? t("routes.sendUpdatedVersion") : t("routes.sendToWahoo")}
                  </button>
                  {latest?.error && (
                    <span className="ml-2 text-sm text-red-700">
                      {t("routes.sendToWahooFailed", { error: latest.error })}
                    </span>
                  )}
                </form>
              );
            })()}
          </div>
        )}
      </div>

      {pushStatus && (
        <div
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            pushStatus === "success"
              ? "bg-green-50 text-green-800"
              : "bg-amber-50 text-amber-900"
          }`}
        >
          {pushStatus === "success" && t("routes.sendToWahooBanner.success")}
          {pushStatus === "needs_permission" && t("routes.sendToWahooBanner.needsPermission")}
          {pushStatus === "no_connection" && t("routes.sendToWahooBanner.noConnection")}
          {pushStatus === "no_geometry" && t("routes.sendToWahooBanner.noGeometry")}
          {pushStatus === "error" && pushErrorCode === "validation" &&
            t("routes.sendToWahooBanner.validation")}
          {pushStatus === "error" && pushErrorCode === "rate_limit" &&
            t("routes.sendToWahooBanner.rateLimit")}
          {pushStatus === "error" && pushErrorCode === "token_expired" &&
            t("routes.sendToWahooBanner.tokenExpired")}
          {pushStatus === "error" && (!pushErrorCode || pushErrorCode === "generic") &&
            t("routes.sendToWahooBanner.generic")}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {route.distance != null && (
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-2xl font-bold text-gray-900">
              {(route.distance / 1000).toFixed(1)} km
            </p>
            <p className="text-sm text-gray-500">{t("routes.distance")}</p>
          </div>
        )}
        {route.elevationGain != null && (
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-2xl font-bold text-gray-900">↑ {route.elevationGain} m</p>
            <p className="text-sm text-gray-500">Ascent</p>
          </div>
        )}
        {route.elevationLoss != null && (
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-2xl font-bold text-gray-900">↓ {route.elevationLoss} m</p>
            <p className="text-sm text-gray-500">Descent</p>
          </div>
        )}
      </div>

      {dayStats.length > 1 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900">{t("routes.dayBreakdown")}</h2>
          <div className="mt-3 divide-y divide-gray-200 rounded-md border border-gray-200">
            {dayStats.map((day) => (
              <div
                key={day.dayNumber}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
                onMouseEnter={() => setHighlightedDay(day.dayNumber)}
                onMouseLeave={() => setHighlightedDay(null)}
              >
                <span className="text-sm font-medium text-gray-700">
                  {t("routes.dayLabel", { n: day.dayNumber })}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-500">
                  {day.startName && day.endName
                    ? `${day.startName} → ${day.endName}`
                    : day.startName || day.endName || ""}
                </span>
                <span className="text-sm tabular-nums text-gray-700">
                  {(day.distance / 1000).toFixed(1)} km
                </span>
                <span className="text-xs text-gray-500">
                  ↑{day.ascent} m
                </span>
                <span className="text-xs text-gray-500">
                  ↓{day.descent} m
                </span>
                {route.hasGpx && (
                  <a
                    href={`/api/routes/${route.id}/gpx?day=${day.dayNumber}`}
                    download
                    className="shrink-0 rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    title={t("routes.exportGpx")}
                  >
                    GPX
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {waypoints.some((w) => w.osmId || w.poiTags || w.note) && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900">{t("routes.waypoints")}</h2>
          <ul className="mt-3 divide-y divide-gray-200 rounded-md border border-gray-200">
            {waypoints.filter((w) => w.osmId || w.poiTags || w.note || w.name).map((w, i) => (
              <li key={i} className="px-4 py-3">
                <p className="font-medium text-gray-900">
                  {w.name ?? `${w.lat.toFixed(5)}, ${w.lon.toFixed(5)}`}
                </p>
                {w.note && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{w.note}</p>
                )}
                {w.poiTags && (
                  <dl className="mt-1 space-y-0.5 text-sm text-gray-600">
                    {w.poiTags.phone && (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-gray-400">{t("routes.poi.phone")}</dt>
                        <dd><a href={`tel:${w.poiTags.phone}`} className="hover:underline">{w.poiTags.phone}</a></dd>
                      </div>
                    )}
                    {w.poiTags.website && (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-gray-400">{t("routes.poi.website")}</dt>
                        <dd><a href={w.poiTags.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">{w.poiTags.website}</a></dd>
                      </div>
                    )}
                    {w.poiTags.opening_hours && (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-gray-400">{t("routes.poi.openingHours")}</dt>
                        <dd>{w.poiTags.opening_hours}</dd>
                      </div>
                    )}
                    {(w.poiTags["addr:street"] || w.poiTags["addr:city"]) && (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-gray-400">{t("routes.poi.address")}</dt>
                        <dd>
                          {[
                            w.poiTags["addr:street"] && `${w.poiTags["addr:street"]}${w.poiTags["addr:housenumber"] ? " " + w.poiTags["addr:housenumber"] : ""}`,
                            w.poiTags["addr:postcode"] && w.poiTags["addr:city"]
                              ? `${w.poiTags["addr:postcode"]} ${w.poiTags["addr:city"]}`
                              : w.poiTags["addr:city"],
                          ].filter(Boolean).join(", ")}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {route.geojson && (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200" style={{ height: 400 }}>
          <ClientMap geojson={route.geojson} interactive className="h-full w-full" dayBreaks={route.dayBreaks.length > 0 ? route.dayBreaks : undefined} highlightedDay={highlightedDay} />
        </div>
      )}

      {isEmpty && (
        <div className="mt-6 flex flex-col items-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
          <div className="text-4xl" aria-hidden="true">🗺️</div>
          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            {t("routes.empty.heading")}
          </h2>
          <p className="mt-2 max-w-md text-sm text-gray-600">
            {isOwner ? t("routes.empty.bodyOwner") : t("routes.empty.bodyViewer")}
          </p>
          {isOwner && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleEditInPlanner}
                disabled={editLoading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {editLoading ? t("routes.opening") : t("routes.empty.openInPlanner")}
              </button>
              <a
                href={`/routes/${route.id}/edit`}
                className="text-sm text-gray-600 underline hover:text-gray-900"
              >
                {t("routes.empty.uploadGpx")}
              </a>
            </div>
          )}
        </div>
      )}

      {versions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Version History</h2>
          <ul className="mt-3 divide-y divide-gray-200">
            {versions.map((v) => (
              <li key={v.version} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">v{v.version}</span>
                  <span className="text-sm text-gray-500">
                    <ClientDate iso={v.createdAt} />
                  </span>
                </div>
                {v.changeDescription && (
                  <p className="text-sm text-gray-500">{v.changeDescription}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOwner && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <form method="post" onSubmit={(e) => {
            if (!confirm("Are you sure you want to delete this route?")) {
              e.preventDefault();
            }
          }}>
            <input type="hidden" name="intent" value="delete" />
            <button
              type="submit"
              className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100"
            >
              {t("routes.delete")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
