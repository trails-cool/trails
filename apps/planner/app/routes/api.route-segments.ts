import { data } from "react-router";
import type { Route } from "./+types/api.route-segments";
import { fetchSegments, BRouterError } from "~/lib/brouter";
import { checkRateLimit } from "~/lib/rate-limit";
import { requireSession } from "~/lib/require-session";

// Client-side segment cache endpoint: the browser sends only the
// waypoint pairs it doesn't already have cached; the server fetches those
// from BRouter in parallel and returns the raw responses in order. The
// merge into an EnrichedRoute happens in the browser so unchanged pairs
// never cross the network.
//
// Session-binding + per-session rate limiting mirror /api/route: the
// Planner is not an anonymous BRouter proxy.
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { pairs, profile, sessionId, noGoAreas } = body as {
    pairs: Array<{ from: { lat: number; lon: number }; to: { lat: number; lon: number } }>;
    profile?: string;
    sessionId?: string;
    noGoAreas?: Array<{ points: Array<{ lat: number; lon: number }> }>;
  };

  if (!Array.isArray(pairs) || pairs.length === 0) {
    return data({ error: "At least 1 pair is required" }, { status: 400 });
  }

  const session = await requireSession(sessionId);
  if (session instanceof Response) return session;

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
    const segments = await fetchSegments({ pairs, profile, noGoAreas });
    return data(
      { segments },
      { headers: { "X-RateLimit-Remaining": String(limit.remaining) } },
    );
  } catch (e) {
    if (e instanceof BRouterError && e.statusCode >= 400 && e.statusCode < 500) {
      return data({ error: e.message, code: "no_route" }, { status: 422 });
    }
    const message = e instanceof Error ? e.message : "Route computation failed";
    return data({ error: message, code: "server_error" }, { status: 502 });
  }
}
