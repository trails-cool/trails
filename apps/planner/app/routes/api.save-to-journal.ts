// Server-side proxy for "Save to Journal". Looks up the session's
// callbackUrl + callbackToken (stored at /new time when the user came
// from the journal) and POSTs the GPX to the journal as a Bearer.
//
// Why this exists (planner-audit #2, Phase A): the previous flow had
// the browser fetch with the bearer token directly, exposing it in
// DevTools / to any XSS / browser extension. Now the token never
// leaves the planner's server-side trust boundary.
//
// Trust model: the same sessionId that grants Yjs membership grants
// save authority. Knowing the URL = ability to act. This matches the
// existing model — we're not strengthening or weakening it, just
// keeping the JWT off the wire to the browser.

import { data } from "react-router";
import type { Route } from "./+types/api.save-to-journal";
import { getSession } from "~/lib/sessions";
import { fetchWithTimeout } from "~/lib/http.server";

interface SaveRequestBody {
  sessionId?: unknown;
  gpx?: unknown;
}

const MAX_GPX_BYTES = 5 * 1024 * 1024; // 5 MB — same ceiling as the Yjs doc cap

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  let body: SaveRequestBody;
  try {
    body = (await request.json()) as SaveRequestBody;
  } catch {
    return data({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const gpx = typeof body.gpx === "string" ? body.gpx : "";

  if (!sessionId) return data({ error: "sessionId required" }, { status: 400 });
  if (!gpx) return data({ error: "gpx required" }, { status: 400 });
  if (gpx.length > MAX_GPX_BYTES) {
    return data({ error: "gpx too large" }, { status: 413 });
  }

  const session = await getSession(sessionId);
  if (!session) return data({ error: "session not found" }, { status: 404 });
  if (!session.callbackUrl || !session.callbackToken) {
    return data({ error: "session has no journal callback" }, { status: 400 });
  }

  let resp: Response;
  try {
    resp = await fetchWithTimeout(session.callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.callbackToken}`,
      },
      body: JSON.stringify({ gpx }),
    });
  } catch {
    return data({ error: "journal unreachable" }, { status: 502 });
  }

  // Forward the journal's response (status + body) so the client UI
  // can render the same error/success it would have before.
  const text = await resp.text();
  let payload: unknown;
  try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  return data(payload, { status: resp.status });
}
