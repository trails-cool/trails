import { data } from "react-router";
import type { Route } from "./+types/api.sessions";
import { createSession, listSessions } from "~/lib/sessions";
import { parseGpxAsync } from "@trails-cool/gpx";
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

    let initialWaypoints: Array<{ lat: number; lon: number; name?: string }> | undefined;
    if (gpx) {
      try {
        const gpxData = await parseGpxAsync(gpx);
        // Use explicit waypoints if present, otherwise extract from track segments
        if (gpxData.waypoints.length > 0) {
          initialWaypoints = gpxData.waypoints;
        } else if (gpxData.tracks.length > 0) {
          const extracted: Array<{ lat: number; lon: number }> = [];
          for (const seg of gpxData.tracks) {
            if (seg.length === 0) continue;
            const first = seg[0]!;
            const prev = extracted[extracted.length - 1];
            if (!prev || prev.lat !== first.lat || prev.lon !== first.lon) {
              extracted.push({ lat: first.lat, lon: first.lon });
            }
          }
          const lastSeg = gpxData.tracks[gpxData.tracks.length - 1]!;
          if (lastSeg.length > 0) {
            const last = lastSeg[lastSeg.length - 1]!;
            const prev = extracted[extracted.length - 1];
            if (!prev || prev.lat !== last.lat || prev.lon !== last.lon) {
              extracted.push({ lat: last.lat, lon: last.lon });
            }
          }
          initialWaypoints = extracted;
        }
      } catch {
        // Continue with empty session if GPX is invalid
      }
    }

    return data(
      { sessionId: session.id, url: `/session/${session.id}`, initialWaypoints },
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
