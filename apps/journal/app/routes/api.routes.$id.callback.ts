import { data } from "react-router";
import type { Route } from "./+types/api.routes.$id.callback";
import { verifyRouteToken } from "~/lib/jwt.server";
import { updateRoute, getRoute } from "~/lib/routes.server";

const PLANNER_ORIGIN = process.env.PLANNER_URL ?? "http://localhost:3001";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": PLANNER_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  return data({ error: "Method not allowed" }, { status: 405, headers: corsHeaders() });
}

export async function action({ params, request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405, headers: corsHeaders() });
  }

  // Verify JWT token from Authorization header or body
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return data({ error: "Missing authorization token" }, { status: 401, headers: corsHeaders() });
  }

  try {
    const { routeId, permissions } = await verifyRouteToken(token);

    // Verify token is for this route
    if (routeId !== params.id) {
      return data({ error: "Token not valid for this route" }, { status: 403, headers: corsHeaders() });
    }

    if (!permissions.includes("write")) {
      return data({ error: "Token does not have write permission" }, { status: 403, headers: corsHeaders() });
    }

    // Get route to verify it exists
    const route = await getRoute(params.id);
    if (!route) {
      return data({ error: "Route not found" }, { status: 404, headers: corsHeaders() });
    }

    // Parse GPX from request body
    const body = await request.json();
    const { gpx } = body as { gpx: string };

    if (!gpx) {
      return data({ error: "Missing GPX data" }, { status: 400, headers: corsHeaders() });
    }

    // Update route with new GPX (creates new version)
    await updateRoute(params.id, route.ownerId, { gpx });

    return data({ success: true, routeId: params.id }, { headers: corsHeaders() });
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 401, headers: corsHeaders() });
  }
}
