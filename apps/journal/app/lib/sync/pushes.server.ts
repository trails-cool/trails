import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { gpxToFitCourse } from "@trails-cool/fit";
import { parseGpxAsync } from "@trails-cool/gpx";
import { routeVersions, syncPushes } from "@trails-cool/db/schema/journal";
import { getDb } from "../db.ts";
import { getRoute } from "../routes.server.ts";
import { getConnection, updateTokens } from "./connections.server.ts";
import { getProvider } from "./registry.ts";
import { PushError, providerSupportsPush } from "./types.ts";
import type { TokenSet } from "./types.ts";

export type PushOutcome =
  | { status: "success"; remoteId: string; pushedAt: Date }
  | { status: "scope_missing" }
  | { status: "no_connection" }
  | { status: "not_owner" }
  | { status: "not_found" }
  | { status: "unsupported_provider" }
  | { status: "no_geometry" }
  | { status: "error"; code: "validation" | "rate_limit" | "token_expired" | "generic"; message: string };

export interface PushRouteOptions {
  userId: string;
  providerId: string;
  routeId: string;
}

/**
 * End-to-end push pipeline. Resolves the route, checks ownership and scopes,
 * short-circuits on already-pushed versions, refreshes tokens on 401, and
 * records the outcome in `sync_pushes`.
 */
export async function pushRouteToProvider(opts: PushRouteOptions): Promise<PushOutcome> {
  const { userId, providerId, routeId } = opts;
  const db = getDb();

  const provider = getProvider(providerId);
  if (!provider) return { status: "not_found" };
  if (!providerSupportsPush(provider)) return { status: "unsupported_provider" };

  const route = await getRoute(routeId);
  if (!route) return { status: "not_found" };
  if (route.ownerId !== userId) return { status: "not_owner" };

  const connection = await getConnection(userId, providerId);
  if (!connection) return { status: "no_connection" };
  if (!connection.grantedScopes.includes("routes_write")) return { status: "scope_missing" };

  const [latestVersion] = await db
    .select()
    .from(routeVersions)
    .where(eq(routeVersions.routeId, routeId))
    .orderBy(desc(routeVersions.version))
    .limit(1);

  const versionGpx = latestVersion?.gpx ?? route.gpx;
  const versionNumber = latestVersion?.version ?? 1;
  if (!versionGpx) return { status: "no_geometry" };

  // Idempotency key is per (user, route, provider) — a logical Wahoo route is
  // per-route, not per-version. The version that's currently on Wahoo is a
  // property of the row, not part of the key.
  const existing = await db
    .select()
    .from(syncPushes)
    .where(
      and(
        eq(syncPushes.userId, userId),
        eq(syncPushes.routeId, routeId),
        eq(syncPushes.provider, providerId),
      ),
    )
    .limit(1);
  const existingRow = existing[0];
  // Already-pushed unchanged route: short-circuit.
  if (
    existingRow?.pushedAt &&
    existingRow.remoteId &&
    existingRow.lastPushedVersion === versionNumber
  ) {
    return { status: "success", remoteId: existingRow.remoteId, pushedAt: existingRow.pushedAt };
  }

  // Build payload from the locked-in version GPX, not routes.gpx.
  const parsed = await parseGpxAsync(versionGpx);
  const points = parsed.tracks.flat();
  if (points.length === 0) return { status: "no_geometry" };

  const fit = await gpxToFitCourse({
    gpx: versionGpx,
    name: route.name,
    description: route.description ?? undefined,
  });

  const externalId = `route:${routeId}`;
  const payload = {
    fit,
    externalId,
    providerUpdatedAt: new Date(),
    name: route.name,
    description: route.description ?? undefined,
    startLat: points[0]!.lat,
    startLng: points[0]!.lon,
    distance: parsed.distance,
    ascent: parsed.elevation.gain,
  };

  let tokens: TokenSet = {
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiresAt: connection.expiresAt,
    providerUserId: connection.providerUserId ?? undefined,
  };

  if (Date.now() >= tokens.expiresAt.getTime()) {
    tokens = await provider.refreshToken(tokens.refreshToken);
    await updateTokens(connection.id, tokens);
  }

  const recordResult = async (
    success: boolean,
    remoteId: string | null,
    error: string | null,
  ): Promise<void> => {
    const now = new Date();
    if (existingRow) {
      await db
        .update(syncPushes)
        .set({
          remoteId,
          lastPushedVersion: success ? versionNumber : existingRow.lastPushedVersion,
          pushedAt: success ? now : null,
          error,
          updatedAt: now,
        })
        .where(eq(syncPushes.id, existingRow.id));
    } else {
      await db.insert(syncPushes).values({
        id: randomUUID(),
        userId,
        routeId,
        provider: providerId,
        externalId,
        remoteId,
        lastPushedVersion: success ? versionNumber : null,
        pushedAt: success ? now : null,
        error,
      });
    }
  };

  // POST on first push (or after a failed push with no remote_id), PUT on
  // subsequent pushes. PUT 404 means the user deleted the Wahoo route on
  // their side — fall back to POST and overwrite remote_id.
  const callProvider = async (toks: TokenSet) => {
    if (existingRow?.remoteId && provider.updateRoute) {
      try {
        return await provider.updateRoute(toks, existingRow.remoteId, payload);
      } catch (e) {
        if (e instanceof PushError && e.code === "not_found") {
          return provider.pushRoute(toks, payload);
        }
        throw e;
      }
    }
    return provider.pushRoute(toks, payload);
  };

  try {
    let result;
    try {
      result = await callProvider(tokens);
    } catch (e) {
      if (e instanceof PushError && e.code === "token_expired") {
        // 401 mid-call — refresh once and retry.
        tokens = await provider.refreshToken(tokens.refreshToken);
        await updateTokens(connection.id, tokens);
        result = await callProvider(tokens);
      } else {
        throw e;
      }
    }
    await recordResult(true, result.remoteId, null);
    return { status: "success", remoteId: result.remoteId, pushedAt: new Date() };
  } catch (e) {
    if (e instanceof PushError) {
      await recordResult(false, null, `${e.code}: ${e.message}`);
      if (e.code === "scope_missing") return { status: "scope_missing" };
      // not_found should have been handled by the PUT→POST fallback; if it
      // ever surfaces here it means even the POST returned 404. Surface as
      // a generic error rather than widening the public PushOutcome union.
      const code = e.code === "not_found" ? "generic" : e.code;
      return { status: "error", code, message: e.message };
    }
    const message = e instanceof Error ? e.message : String(e);
    await recordResult(false, null, `generic: ${message}`);
    return { status: "error", code: "generic", message };
  }
}

// State payload encoded into the OAuth `state` query param so the callback
// can resume a push that was interrupted by a re-auth redirect.
export interface PushOAuthState {
  pushAfter?: { routeId: string };
  returnTo?: string;
}

export function encodeOAuthState(state: PushOAuthState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeOAuthState(raw: string | null | undefined): PushOAuthState {
  if (!raw) return {};
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as PushOAuthState;
    return typeof parsed === "object" && parsed != null ? parsed : {};
  } catch {
    return {};
  }
}
