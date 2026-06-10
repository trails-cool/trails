import { data } from "react-router";
import type { Route } from "./+types/api.sessions";
import { createSession, listSessions } from "~/lib/sessions";
import { parseGpxAsync, extractWaypoints } from "@trails-cool/gpx";
import { withDb } from "@trails-cool/db";
import type { Waypoint } from "@trails-cool/types";
import { validateFetchUrl, getCallbackAllowedHosts } from "~/lib/url-validation.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { callbackUrl, callbackToken, gpx } = body as {
    callbackUrl?: string;
    callbackToken?: string;
    gpx?: string;
  };

  // callbackUrl becomes a server-side fetch target on save-to-journal,
  // so an unvalidated value here is an SSRF sink. The /new loader
  // already validates the query-param form; this is the programmatic
  // JSON entry point and must do the same.
  if (callbackUrl !== undefined) {
    if (typeof callbackUrl !== "string") {
      return data({ error: "callbackUrl must be a string" }, { status: 400 });
    }
    const v = validateFetchUrl(callbackUrl, { allowedHosts: getCallbackAllowedHosts() });
    if (!v.ok) {
      return data({ error: `Invalid callback URL: ${v.reason}` }, { status: 400 });
    }
  }

  return withDb(async () => {
    const session = await createSession({ callbackUrl, callbackToken });

    let initialWaypoints: Waypoint[] | undefined;
    let initialNoGoAreas: Array<{ points: Array<{ lat: number; lon: number }> }> | undefined;
    let initialNotes: string | undefined;
    if (gpx) {
      try {
        const gpxData = await parseGpxAsync(gpx);
        const wps = extractWaypoints(gpxData);
        if (wps.length > 0) initialWaypoints = wps;
        if (gpxData.noGoAreas.length > 0) initialNoGoAreas = gpxData.noGoAreas;
        if (gpxData.description) initialNotes = gpxData.description;
      } catch {
        // Continue with empty session if GPX is invalid
      }
    }

    return data(
      { sessionId: session.id, url: `/session/${session.id}`, initialWaypoints, initialNoGoAreas, initialNotes },
      { status: 201 },
    );
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  return withDb(async () => {
    const url = new URL(request.url);
    // Accept an explicit `?limit=` but rely on listSessions to clamp
    // it to a sane upper bound.
    const limitParam = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;
    const sessions = await listSessions(limit);
    return data({ sessions });
  });
}
