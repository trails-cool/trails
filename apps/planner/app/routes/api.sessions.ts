import { data } from "react-router";
import type { Route } from "./+types/api.sessions";
import { createSession, listSessions } from "~/lib/sessions";
import { parseGpxAsync } from "@trails-cool/gpx";

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

  try {
    const session = await createSession({ callbackUrl, callbackToken });

    let initialWaypoints: Array<{ lat: number; lon: number; name?: string }> | undefined;
    if (gpx) {
      try {
        const gpxData = await parseGpxAsync(gpx);
        initialWaypoints = gpxData.waypoints;
      } catch {
        // Continue with empty session if GPX is invalid
      }
    }

    return data(
      {
        sessionId: session.id,
        url: `/session/${session.id}`,
        initialWaypoints,
      },
      { status: 201 },
    );
  } catch (e) {
    return data(
      { error: "Database unavailable", details: (e as Error).message },
      { status: 503 },
    );
  }
}

export async function loader(_args: Route.LoaderArgs) {
  try {
    const sessions = await listSessions();
    return data({ sessions });
  } catch {
    return data({ sessions: [], error: "Database unavailable" });
  }
}
