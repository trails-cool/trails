import { useState, useCallback } from "react";
import { data, redirect } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/routes.$id";
import { getSessionUser } from "~/lib/auth.server";
import { getRoute, getRouteWithVersions, deleteRoute, updateRoute } from "~/lib/routes.server";
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

  // Compute per-day stats if route has day breaks and GPX
  let dayStats: Array<{ dayNumber: number; startName?: string; endName?: string; distance: number; ascent: number; descent: number }> = [];
  if (route.dayBreaks && route.dayBreaks.length > 0 && route.gpx) {
    try {
      const { computeDays } = await import("@trails-cool/gpx");
      const { parseGpxAsync } = await import("@trails-cool/gpx");
      const gpxData = await parseGpxAsync(route.gpx);
      dayStats = computeDays(gpxData.waypoints, gpxData.tracks);
    } catch {
      // Fall back to no day stats
    }
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
      createdAt: route.createdAt.toISOString(),
      updatedAt: route.updatedAt.toISOString(),
    },
    dayStats,
    versions: route.versions.map((v) => ({
      version: v.version,
      changeDescription: v.changeDescription,
      createdAt: v.createdAt.toISOString(),
    })),
    isOwner,
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
  const name = (loaderData as { route: { name: string } })?.route?.name ?? "Route";
  return [{ title: `${name} — trails.cool` }];
}

export default function RouteDetailPage({ loaderData }: Route.ComponentProps) {
  const { route, dayStats, versions, isOwner } = loaderData;
  const { t } = useTranslation("journal");
  const [editLoading, setEditLoading] = useState(false);

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
        {isOwner && (
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
          </div>
        )}
      </div>

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
              <div key={day.dayNumber} className="flex items-center gap-4 px-4 py-3">
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
              </div>
            ))}
          </div>
        </div>
      )}

      {route.geojson && (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200" style={{ height: 400 }}>
          <ClientMap geojson={route.geojson} interactive className="h-full w-full" dayBreaks={route.dayBreaks.length > 0 ? route.dayBreaks : undefined} />
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
