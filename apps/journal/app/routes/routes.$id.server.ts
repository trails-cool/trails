// Server-only loader/action for /routes/:id. See `home.server.ts`.

import { data, redirect } from "react-router";
import { and, eq } from "drizzle-orm";
import { canView } from "~/lib/auth.server";
import { getSessionUser, requireSessionUser } from "~/lib/auth/session.server";
import { getRoute, getRouteWithVersions, deleteRoute, updateRoute } from "~/lib/routes.server";
import { requireOwnedRoute } from "~/lib/ownership.server";
import { getDb } from "~/lib/db";
import { syncPushes } from "@trails-cool/db/schema/journal";
import { getService } from "~/lib/connected-services";
import { computeDays, parseGpxAsync, elevationSeries } from "@trails-cool/gpx";
import type { ElevationSample } from "@trails-cool/gpx";

export async function loadRouteDetail(request: Request, id: string | undefined) {
  const routeId = id ?? "";
  const [routeWithVersions, routeWithGeojson] = await Promise.all([
    getRouteWithVersions(routeId),
    getRoute(routeId),
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
  let elevation: ElevationSample[] = [];
  if (route.gpx) {
    try {
      const gpxData = await parseGpxAsync(route.gpx);
      elevation = elevationSeries(gpxData.tracks);
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

  return {
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
      elevation,
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
  };
}

export async function routeDetailAction(request: Request, id: string | undefined) {
  const user = await requireSessionUser(request);
  const routeId = id ?? "";

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const route = await requireOwnedRoute(routeId, user.id);
    await deleteRoute(route);
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

    const route = await requireOwnedRoute(routeId, user.id);
    await updateRoute(route, input as { name?: string; description?: string; gpx?: string });
    return redirect(`/routes/${routeId}`);
  }

  return data({ error: "Unknown action" }, { status: 400 });
}
