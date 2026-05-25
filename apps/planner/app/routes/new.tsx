import { redirect, data } from "react-router";
import type { Route } from "./+types/new";
import { createSession, initializeSessionWithWaypoints, initializeSessionWithNoGoAreas } from "~/lib/sessions";
import { parseGpxAsync, extractWaypoints } from "@trails-cool/gpx";
import { checkRateLimit } from "~/lib/rate-limit";
import {
  validateFetchUrl,
  validateRedirectUrl,
  getCallbackAllowedHosts,
} from "~/lib/url-validation.server";

// Query-param hard caps so an attacker can't shovel multi-MB strings
// into our URL parser / session-storage path.
const MAX_GPX_QUERY_LEN = 2_000_000; // GPX intentionally allowed to be large (full route)
const MAX_URL_PARAM_LEN = 2048;

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

  // Validate the callback URL — it will be used as a fetch target on
  // save-to-journal. Reject non-http(s) schemes (no `file:` / `javascript:`),
  // and if PLANNER_CALLBACK_ALLOWED_HOSTS is set, restrict to those hosts.
  if (callbackUrl) {
    const v = validateFetchUrl(callbackUrl, {
      allowedHosts: getCallbackAllowedHosts(),
      maxLength: MAX_URL_PARAM_LEN,
    });
    if (!v.ok) {
      throw data({ error: `Invalid callback URL: ${v.reason}` }, { status: 400 });
    }
  }
  if (token && token.length > MAX_URL_PARAM_LEN) {
    throw data({ error: "callback token too long" }, { status: 400 });
  }
  if (returnUrl) {
    const v = validateRedirectUrl(returnUrl, { maxLength: MAX_URL_PARAM_LEN });
    if (!v.ok) {
      throw data({ error: `Invalid returnUrl: ${v.reason}` }, { status: 400 });
    }
  }
  if (gpxEncoded && gpxEncoded.length > MAX_GPX_QUERY_LEN) {
    throw data({ error: "GPX payload too large" }, { status: 413 });
  }

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
      initializeSessionWithWaypoints(session.id, extractWaypoints(gpxData));
      if (gpxData.noGoAreas.length > 0) {
        initializeSessionWithNoGoAreas(session.id, gpxData.noGoAreas);
      }
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
