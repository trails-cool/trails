import { redirect, data } from "react-router";
import type { Route } from "./+types/new";
import { createSession, initializeSessionWithWaypoints } from "~/lib/sessions";
import { parseGpxAsync } from "@trails-cool/gpx";
import { checkRateLimit } from "~/lib/rate-limit";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);

  // Rate limit session creation by IP
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const limit = checkRateLimit(`session-create:${ip}`, { maxRequests: 10 });
  if (!limit.allowed) {
    throw data(
      { error: "Too many sessions created. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const callbackUrl = url.searchParams.get("callback");
  const token = url.searchParams.get("token");
  const returnUrl = url.searchParams.get("returnUrl");
  const gpxEncoded = url.searchParams.get("gpx");

  // Create a session with callback info
  const session = await createSession({
    callbackUrl: callbackUrl ?? undefined,
    callbackToken: token ?? undefined,
  });

  // Initialize with GPX waypoints if provided
  if (gpxEncoded) {
    try {
      const gpx = decodeURIComponent(gpxEncoded);
      const gpxData = await parseGpxAsync(gpx);
      // Use explicit waypoints if present, otherwise extract from track segments
      let waypoints = gpxData.waypoints;
      if (waypoints.length === 0 && gpxData.tracks.length > 0) {
        const extracted: Array<{ lat: number; lon: number }> = [];
        for (const seg of gpxData.tracks) {
          if (seg.length === 0) continue;
          const first = seg[0]!;
          // Deduplicate: skip if same as previous waypoint
          const prev = extracted[extracted.length - 1];
          if (!prev || prev.lat !== first.lat || prev.lon !== first.lon) {
            extracted.push({ lat: first.lat, lon: first.lon });
          }
        }
        // Add the end of the last segment
        const lastSeg = gpxData.tracks[gpxData.tracks.length - 1]!;
        if (lastSeg.length > 0) {
          const last = lastSeg[lastSeg.length - 1]!;
          const prev = extracted[extracted.length - 1];
          if (!prev || prev.lat !== last.lat || prev.lon !== last.lon) {
            extracted.push({ lat: last.lat, lon: last.lon });
          }
        }
        waypoints = extracted;
      }
      initializeSessionWithWaypoints(session.id, waypoints);
    } catch {
      // Continue with empty session if GPX is invalid
    }
  }

  // Store returnUrl in the session URL for later
  const sessionUrl = returnUrl
    ? `/session/${session.id}?returnUrl=${encodeURIComponent(returnUrl)}`
    : `/session/${session.id}`;

  return redirect(sessionUrl);
}
