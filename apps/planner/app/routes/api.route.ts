import { data } from "react-router";
import type { Route } from "./+types/api.route";
import { computeRoute, computeSegmentGpx, BRouterError } from "~/lib/brouter";
import { checkRateLimit } from "~/lib/rate-limit";
import { requireSession } from "~/lib/require-session";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { waypoints, profile, sessionId, noGoAreas, format } = body as {
    waypoints: Array<{ lat: number; lon: number }>;
    profile?: string;
    sessionId?: string;
    noGoAreas?: Array<{ points: Array<{ lat: number; lon: number }> }>;
    format?: "geojson" | "gpx";
  };

  if (!waypoints || waypoints.length < 2) {
    return data({ error: "At least 2 waypoints are required" }, { status: 400 });
  }

  // Session-bind: only live planner sessions can compute routes through
  // us, so we don't act as an anonymous BRouter proxy for scrapers.
  const session = await requireSession(sessionId);
  if (session instanceof Response) return session;

  // Rate limit by session ID (always present after requireSession)
  const limit = checkRateLimit(`route:${session.id}`);

  if (!limit.allowed) {
    return data(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  try {
    // `format: "gpx"` returns BRouter's raw GPX without the way-tag
    // enrichment the interactive planner needs. Used by server-to-server
    // callers (e.g. the Journal's demo-bot) that just want the track.
    if (format === "gpx") {
      const gpx = await computeSegmentGpx({ waypoints, profile, noGoAreas });
      return new Response(gpx, {
        status: 200,
        headers: {
          "content-type": "application/gpx+xml; charset=utf-8",
          "x-ratelimit-remaining": String(limit.remaining),
        },
      });
    }

    const route = await computeRoute({ waypoints, profile, noGoAreas });
    return data(route, {
      headers: { "X-RateLimit-Remaining": String(limit.remaining) },
    });
  } catch (e) {
    if (e instanceof BRouterError && e.statusCode >= 400 && e.statusCode < 500) {
      // BRouter client error: unroutable waypoints, missing tiles, etc.
      return data({ error: e.message, code: "no_route" }, { status: 422 });
    }
    const message = e instanceof Error ? e.message : "Route computation failed";
    return data({ error: message, code: "server_error" }, { status: 502 });
  }
}
