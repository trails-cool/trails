// Wahoo RoutePusher capability adapter.
//
// Exposes the seam shape `pushRoute(ctx, input) -> {remoteId, version}` per
// ADR-0003. Wahoo specifics — FIT-Course conversion, the `route:<id>`
// external_id convention, the PUT-vs-POST decision based on sync_pushes,
// and the PUT-on-404 → POST fallback — live entirely inside this module
// and never appear on the seam.
//
// Idempotency state lives in `journal.sync_pushes`. The seam returns the
// remote id and the local version that was pushed; the caller is free to
// inspect the table for richer state.

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { gpxToFitCourse } from "@trails-cool/fit";
import { syncPushes } from "@trails-cool/db/schema/journal";
import { getDb } from "../../../db.ts";
import { getServiceById } from "../../manager.ts";
import type {
  CapabilityContext,
  RoutePushInput,
  RoutePushResult,
  RoutePusher,
} from "../../registry.ts";
import type { OAuthCredentials } from "../../types.ts";

const WAHOO_API = "https://api.wahooligan.com";

interface WahooErrorShape {
  status: number;
  body: string;
}

class WahooHttpError extends Error {
  shape: WahooErrorShape;
  constructor(shape: WahooErrorShape) {
    super(`Wahoo route ${shape.status}: ${shape.body}`);
    this.shape = shape;
  }
}

function externalIdFor(routeId: string): string {
  return `route:${routeId}`;
}

function buildBody(
  fit: Uint8Array,
  input: RoutePushInput,
): URLSearchParams {
  // Wahoo expects route[file] as a data URI, not raw base64. Sending raw
  // base64 results in a route with file.url = null; the app shows
  // metadata but renders no track.
  const fitDataUri = `data:application/vnd.fit;base64,${Buffer.from(fit).toString("base64")}`;
  const body = new URLSearchParams({
    "route[external_id]": externalIdFor(input.routeId),
    "route[provider_updated_at]": new Date().toISOString(),
    "route[name]": input.routeName,
    "route[workout_type_family_id]": "0",
    "route[start_lat]": input.startLat.toString(),
    "route[start_lng]": input.startLng.toString(),
    "route[distance]": input.distance.toString(),
    "route[ascent]": input.ascent.toString(),
    "route[file]": fitDataUri,
  });
  if (input.description) body.set("route[description]", input.description);
  return body;
}

async function postOrPut(
  method: "POST" | "PUT",
  url: string,
  accessToken: string,
  body: URLSearchParams,
  fallbackRemoteId?: string,
): Promise<{ remoteId: string }> {
  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (resp.ok) {
    let remoteId: string | undefined;
    if (resp.status !== 204) {
      const data = (await resp.json().catch(() => null)) as { id?: number | string } | null;
      remoteId = data?.id?.toString();
    }
    remoteId ??= fallbackRemoteId;
    if (!remoteId) throw new Error(`Wahoo response missing route id`);
    return { remoteId };
  }

  const text = await resp.text().catch(() => "");
  throw new WahooHttpError({ status: resp.status, body: text });
}

interface ExistingPush {
  id: string;
  userId: string;
  routeId: string;
  provider: string;
  remoteId: string | null;
  lastPushedVersion: number | null;
  pushedAt: Date | null;
  error: string | null;
}

async function findExistingPush(
  userId: string,
  routeId: string,
): Promise<ExistingPush | null> {
  const db = getDb();
  const rows = (await db
    .select()
    .from(syncPushes)
    .where(
      and(
        eq(syncPushes.userId, userId),
        eq(syncPushes.routeId, routeId),
        eq(syncPushes.provider, "wahoo"),
      ),
    )
    .limit(1)) as ExistingPush[];
  return rows[0] ?? null;
}

async function recordPush(
  existing: ExistingPush | null,
  userId: string,
  input: RoutePushInput,
  remoteId: string,
): Promise<void> {
  const db = getDb();
  const now = new Date();
  if (existing) {
    await db
      .update(syncPushes)
      .set({
        remoteId,
        lastPushedVersion: input.localVersion,
        pushedAt: now,
        error: null,
        updatedAt: now,
      })
      .where(eq(syncPushes.id, existing.id));
  } else {
    await db.insert(syncPushes).values({
      id: randomUUID(),
      userId,
      routeId: input.routeId,
      provider: "wahoo",
      externalId: externalIdFor(input.routeId),
      remoteId,
      lastPushedVersion: input.localVersion,
      pushedAt: now,
      error: null,
    });
  }
}

export const wahooPusher: RoutePusher = {
  async pushRoute(
    ctx: CapabilityContext,
    input: RoutePushInput,
  ): Promise<RoutePushResult> {
    // Resolve the user from the connected service so we can read/write
    // sync_pushes for the right (user, route, provider) tuple.
    const service = await getServiceById(ctx.serviceId);
    if (!service) throw new Error(`Connected service ${ctx.serviceId} not found`);

    const existing = await findExistingPush(service.userId, input.routeId);
    if (
      existing?.pushedAt &&
      existing.remoteId &&
      existing.lastPushedVersion === input.localVersion
    ) {
      return { remoteId: existing.remoteId, version: input.localVersion };
    }

    const fit = await gpxToFitCourse({
      gpx: input.gpx,
      name: input.routeName,
      description: input.description,
    });
    const body = buildBody(fit, input);

    const result = await ctx.withFreshCredentials(async (creds) => {
      const accessToken = (creds as OAuthCredentials).access_token;
      // PUT-vs-POST: PUT in place when we have a remoteId on file.
      if (existing?.remoteId) {
        try {
          return await postOrPut(
            "PUT",
            `${WAHOO_API}/v1/routes/${encodeURIComponent(existing.remoteId)}`,
            accessToken,
            body,
            existing.remoteId,
          );
        } catch (err) {
          // 404 means the user deleted the route on Wahoo's side. Fall
          // back to POST and overwrite the local remoteId.
          if (err instanceof WahooHttpError && err.shape.status === 404) {
            return postOrPut("POST", `${WAHOO_API}/v1/routes`, accessToken, body);
          }
          throw err;
        }
      }
      return postOrPut("POST", `${WAHOO_API}/v1/routes`, accessToken, body);
    });

    await recordPush(existing, service.userId, input, result.remoteId);
    return { remoteId: result.remoteId, version: input.localVersion };
  },
};
