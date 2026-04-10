import { data } from "react-router";
import type { Route } from "./+types/api.sessions";
import { createSession, listSessions } from "~/lib/sessions";
import { parseGpxAsync, extractWaypoints } from "@trails-cool/gpx";
import { withDb } from "@trails-cool/db";

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

  return withDb(async () => {
    const session = await createSession({ callbackUrl, callbackToken });

    let initialWaypoints: Array<{ lat: number; lon: number; name?: string; isDayBreak?: boolean }> | undefined;
    let initialNoGoAreas: Array<{ points: Array<{ lat: number; lon: number }> }> | undefined;
    if (gpx) {
      try {
        const gpxData = await parseGpxAsync(gpx);
        const wps = extractWaypoints(gpxData);
        if (wps.length > 0) initialWaypoints = wps;
        if (gpxData.noGoAreas.length > 0) initialNoGoAreas = gpxData.noGoAreas;
      } catch {
        // Continue with empty session if GPX is invalid
      }
    }

    return data(
      { sessionId: session.id, url: `/session/${session.id}`, initialWaypoints, initialNoGoAreas },
      { status: 201 },
    );
  });
}

export async function loader(_args: Route.LoaderArgs) {
  return withDb(async () => {
    const sessions = await listSessions();
    return data({ sessions });
  });
}
