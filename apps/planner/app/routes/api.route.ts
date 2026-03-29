import { data } from "react-router";
import type { Route } from "./+types/api.route";
import { computeRoute, BRouterError } from "~/lib/brouter";
import { checkRateLimit } from "~/lib/rate-limit";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { waypoints, profile, sessionId, noGoAreas } = body as {
    waypoints: Array<{ lat: number; lon: number }>;
    profile?: string;
    sessionId?: string;
    noGoAreas?: Array<{ points: Array<{ lat: number; lon: number }> }>;
  };

  if (!waypoints || waypoints.length < 2) {
    return data({ error: "At least 2 waypoints are required" }, { status: 400 });
  }

  // Rate limit by session ID or IP
  const rateLimitKey = sessionId ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const limit = checkRateLimit(`route:${rateLimitKey}`);

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
