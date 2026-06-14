import { useState, useCallback, useMemo } from "react";
import { data } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/routes.$id";
import { ClientDate } from "~/components/ClientDate";
import { ClientMap } from "~/components/ClientMap";
import { StatRow } from "~/components/StatRow";
import { ElevationProfile } from "~/components/ElevationProfile";
import { SurfaceBreakdown } from "~/components/SurfaceBreakdown";
import { activityStatItems } from "~/lib/stats";
import { loadRouteDetail, routeDetailAction } from "./routes.$id.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  return data(await loadRouteDetail(request, params.id));
}

export async function action({ params, request }: Route.ActionArgs) {
  return routeDetailAction(request, params.id);
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

  // Elevation profile ↔ map sync via a shared "active" sample index.
  const elevation = route.elevation;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [centerOn, setCenterOn] = useState<{ lat: number; lng: number; v: number } | null>(null);
  const hoverSeries = useMemo(
    () => elevation.map((s) => [s.lat, s.lng] as [number, number]),
    [elevation],
  );
  const activePoint =
    activeIndex != null && elevation[activeIndex]
      ? { lat: elevation[activeIndex]!.lat, lng: elevation[activeIndex]!.lng }
      : null;
  const seekElevation = (i: number) => {
    const s = elevation[i];
    if (s) setCenterOn((prev) => ({ lat: s.lat, lng: s.lng, v: (prev?.v ?? 0) + 1 }));
    setActiveIndex(i);
  };

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

      <StatRow
        size="lg"
        className="mt-6"
        items={activityStatItems(
          {
            distance: route.distance,
            elevationGain: route.elevationGain,
            elevationLoss: route.elevationLoss,
          },
          t,
        )}
      />

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
          <ClientMap
            geojson={route.geojson}
            interactive
            className="h-full w-full"
            dayBreaks={route.dayBreaks.length > 0 ? route.dayBreaks : undefined}
            highlightedDay={highlightedDay}
            activePoint={activePoint}
            hoverSeries={hoverSeries}
            onHoverIndex={setActiveIndex}
            centerOn={centerOn}
          />
        </div>
      )}

      {elevation.length > 1 && (
        <ElevationProfile
          className="mt-4"
          series={elevation}
          activeIndex={activeIndex}
          onActive={setActiveIndex}
          onSeek={seekElevation}
          labels={{ highest: t("elevation.highest"), lowest: t("elevation.lowest") }}
        />
      )}

      <SurfaceBreakdown breakdown={route.surfaceBreakdown} className="mt-6" />

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
