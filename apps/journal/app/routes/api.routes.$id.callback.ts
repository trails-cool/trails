import { data } from "react-router";
import type { Route } from "./+types/api.routes.$id.callback";
import { verifyRouteToken } from "~/lib/jwt.server";
import { updateRoute, getRoute } from "~/lib/routes.server";

export async function action({ params, request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  // Verify JWT token from Authorization header or body
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return data({ error: "Missing authorization token" }, { status: 401 });
  }

  try {
    const { routeId, permissions } = await verifyRouteToken(token);

    // Verify token is for this route
    if (routeId !== params.id) {
      return data({ error: "Token not valid for this route" }, { status: 403 });
    }

    if (!permissions.includes("write")) {
      return data({ error: "Token does not have write permission" }, { status: 403 });
    }

    // Get route to verify it exists
    const route = await getRoute(params.id);
    if (!route) {
      return data({ error: "Route not found" }, { status: 404 });
    }

    // Parse GPX from request body
    const body = await request.json();
    const { gpx } = body as { gpx: string };

    if (!gpx) {
      return data({ error: "Missing GPX data" }, { status: 400 });
    }

    // Update route with new GPX (creates new version)
    await updateRoute(params.id, route.ownerId, { gpx });

    return data({ success: true, routeId: params.id });
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 401 });
  }
}
