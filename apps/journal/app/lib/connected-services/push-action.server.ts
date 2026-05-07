// Orchestrates a route push: load route, check ownership, check scopes,
// build the RoutePushInput, and invoke the provider's RoutePusher
// capability. Replaces the legacy pushRouteToProvider in lib/sync.
//
// The pusher (per-provider) handles HTTP, FIT conversion, idempotency,
// and PUT/POST/404 fallback. This module is the orchestration layer
// callers use (route handlers, OAuth callback resume).

import { desc, eq } from "drizzle-orm";
import { parseGpxAsync } from "@trails-cool/gpx";
import { routeVersions } from "@trails-cool/db/schema/journal";
import { getDb } from "../db.ts";
import { getRoute } from "../routes.server.ts";
import {
  ConnectionNotActiveError,
  NeedsRelinkError,
} from "./types.ts";
import { capabilityContextFor, getService } from "./manager.ts";
import { getManifest, type RoutePushInput } from "./registry.ts";

export type PushOutcome =
  | { status: "success"; remoteId: string; pushedAt: Date }
  | { status: "scope_missing" }
  | { status: "no_connection" }
  | { status: "not_owner" }
  | { status: "not_found" }
  | { status: "unsupported_provider" }
  | { status: "no_geometry" }
  | { status: "needs_relink" }
  | {
      status: "error";
      code: "validation" | "rate_limit" | "token_expired" | "generic";
      message: string;
    };

export interface PushRouteOptions {
  userId: string;
  providerId: string;
  routeId: string;
}

export async function pushRouteToProvider(
  opts: PushRouteOptions,
): Promise<PushOutcome> {
  const { userId, providerId, routeId } = opts;
  const db = getDb();

  const manifest = getManifest(providerId);
  if (!manifest) return { status: "not_found" };
  if (!manifest.routePusher) return { status: "unsupported_provider" };

  const route = await getRoute(routeId);
  if (!route) return { status: "not_found" };
  if (route.ownerId !== userId) return { status: "not_owner" };

  const service = await getService(userId, providerId);
  if (!service) return { status: "no_connection" };
  if (!service.grantedScopes.includes("routes_write")) {
    return { status: "scope_missing" };
  }

  // Pull the locked-in version GPX (not routes.gpx, which is the working copy).
  const [latestVersion] = await db
    .select()
    .from(routeVersions)
    .where(eq(routeVersions.routeId, routeId))
    .orderBy(desc(routeVersions.version))
    .limit(1);

  const versionGpx = latestVersion?.gpx ?? route.gpx;
  const versionNumber = latestVersion?.version ?? 1;
  if (!versionGpx) return { status: "no_geometry" };

  const parsed = await parseGpxAsync(versionGpx);
  const points = parsed.tracks.flat();
  if (points.length === 0) return { status: "no_geometry" };

  const input: RoutePushInput = {
    routeId,
    routeName: route.name,
    description: route.description ?? undefined,
    gpx: versionGpx,
    startLat: points[0]!.lat,
    startLng: points[0]!.lon,
    distance: parsed.distance,
    ascent: parsed.elevation.gain,
    localVersion: versionNumber,
  };

  try {
    const ctx = capabilityContextFor(service.id);
    const result = await manifest.routePusher.pushRoute(ctx, input);
    return {
      status: "success",
      remoteId: result.remoteId,
      pushedAt: new Date(),
    };
  } catch (err) {
    if (err instanceof NeedsRelinkError) return { status: "needs_relink" };
    if (err instanceof ConnectionNotActiveError) return { status: "needs_relink" };
    const message = err instanceof Error ? err.message : String(err);
    // Map known HTTP-shape errors. The pusher throws Error / WahooHttpError;
    // we don't try to recover further here.
    if (message.includes("422")) {
      return { status: "error", code: "validation", message };
    }
    if (message.includes("429")) {
      return { status: "error", code: "rate_limit", message };
    }
    if (message.includes("401") || message.includes("403")) {
      return { status: "error", code: "token_expired", message };
    }
    return { status: "error", code: "generic", message };
  }
}
