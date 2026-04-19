import type { Route } from "./+types/api.v1.routes.$id";
import { requireApiUser, apiError } from "~/lib/api-guard.server";
import { getRouteWithVersions, updateRoute, deleteRoute } from "~/lib/routes.server";
import { UpdateRouteRequestSchema, ERROR_CODES, zodIssuesToFieldErrors } from "@trails-cool/api";

/** GET /api/v1/routes/:id — full route detail */
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  const route = await getRouteWithVersions(params.id);

  if (!route || route.ownerId !== user.id) {
    return apiError(404, ERROR_CODES.NOT_FOUND, "Route not found");
  }

  return Response.json({
    id: route.id,
    name: route.name,
    description: route.description,
    distance: route.distance,
    elevationGain: route.elevationGain,
    elevationLoss: route.elevationLoss,
    routingProfile: route.routingProfile,
    dayBreaks: route.dayBreaks ?? [],
    gpx: route.gpx,
    geojson: null, // TODO: fetch geojson
    versions: route.versions.map((v) => ({
      id: v.id,
      version: v.version,
      createdBy: v.createdBy,
      changeDescription: v.changeDescription,
      createdAt: v.createdAt.toISOString(),
    })),
    createdAt: route.createdAt.toISOString(),
    updatedAt: route.updatedAt.toISOString(),
  });
}

/** PUT /api/v1/routes/:id — update a route */
/** DELETE /api/v1/routes/:id — delete a route */
export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireApiUser(request);

  if (request.method === "PUT") {
    const body = await request.json().catch(() => null);
    const parsed = UpdateRouteRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, ERROR_CODES.VALIDATION_ERROR, "Validation failed",
        zodIssuesToFieldErrors(parsed.error));
    }

    await updateRoute(params.id, user.id, parsed.data);
    return Response.json({ ok: true });
  }

  if (request.method === "DELETE") {
    const deleted = await deleteRoute(params.id, user.id);
    if (!deleted) {
      return apiError(404, ERROR_CODES.NOT_FOUND, "Route not found");
    }
    return new Response(null, { status: 204 });
  }

  return new Response(null, { status: 405 });
}
