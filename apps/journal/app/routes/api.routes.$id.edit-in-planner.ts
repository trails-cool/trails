import { data } from "react-router";
import type { Route } from "./+types/api.routes.$id.edit-in-planner";
import { getSessionUser } from "~/lib/auth.server";
import { getRouteWithVersions } from "~/lib/routes.server";
import { createRouteToken } from "~/lib/jwt.server";

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) return data({ error: "Not authenticated" }, { status: 401 });

  const route = await getRouteWithVersions(params.id);
  if (!route) return data({ error: "Route not found" }, { status: 404 });
  if (route.ownerId !== user.id) return data({ error: "Not authorized" }, { status: 403 });

  const token = await createRouteToken(params.id);
  const origin = process.env.ORIGIN ?? "http://localhost:3000";
  const callbackUrl = `${origin}/api/routes/${params.id}/callback`;
  const plannerUrl = process.env.PLANNER_URL ?? "http://localhost:3001";
  const returnUrl = `${origin}/routes/${params.id}`;

  // Create Planner session via API (POST body, not URL params)
  const sessionResp = await fetch(`${plannerUrl}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callbackUrl,
      callbackToken: token,
      gpx: route.gpx ?? undefined,
    }),
  });

  if (!sessionResp.ok) {
    return data({ error: "Failed to create Planner session" }, { status: 502 });
  }

  const session = (await sessionResp.json()) as {
    url: string;
    initialWaypoints?: Array<{ lat: number; lon: number; name?: string }>;
    initialNoGoAreas?: Array<{ points: Array<{ lat: number; lon: number }> }>;
    initialNotes?: string;
  };

  // Encode planning data in URL params
  const urlParams = new URLSearchParams({ returnUrl });
  if (session.initialWaypoints?.length) {
    urlParams.set("waypoints", JSON.stringify(session.initialWaypoints));
  }
  if (session.initialNoGoAreas?.length) {
    urlParams.set("noGoAreas", JSON.stringify(session.initialNoGoAreas));
  }
  if (session.initialNotes) {
    urlParams.set("notes", session.initialNotes);
  }

  return data({
    url: `${plannerUrl}${session.url}?${urlParams}`,
  });
}
