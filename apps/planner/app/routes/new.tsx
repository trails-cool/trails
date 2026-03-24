import { redirect } from "react-router";
import type { Route } from "./+types/new";
import { createSession, initializeSessionWithWaypoints } from "~/lib/sessions";
import { parseGpx } from "@trails-cool/gpx";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
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
      const gpxData = parseGpx(gpx);
      initializeSessionWithWaypoints(session.id, gpxData.waypoints);
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
