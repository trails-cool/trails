import type { Route } from "./+types/api.v1.activities.$id";
import { requireApiUser, apiError } from "~/lib/api-guard.server";
import { getActivity, deleteActivity } from "~/lib/activities.server";
import { ERROR_CODES } from "@trails-cool/api";

/** GET /api/v1/activities/:id — full activity detail */
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  const activity = await getActivity(params.id);

  if (!activity || activity.ownerId !== user.id) {
    return apiError(404, ERROR_CODES.NOT_FOUND, "Activity not found");
  }

  return Response.json({
    id: activity.id,
    name: activity.name,
    description: activity.description,
    routeId: activity.routeId,
    distance: activity.distance,
    duration: activity.duration,
    elevationGain: activity.elevationGain,
    elevationLoss: activity.elevationLoss,
    startedAt: activity.startedAt?.toISOString() ?? null,
    gpx: activity.gpx,
    geojson: activity.geojson,
    createdAt: activity.createdAt.toISOString(),
  });
}

/** DELETE /api/v1/activities/:id */
export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "DELETE") return new Response(null, { status: 405 });
  const user = await requireApiUser(request);

  const deleted = await deleteActivity(params.id, user.id);
  if (!deleted) {
    return apiError(404, ERROR_CODES.NOT_FOUND, "Activity not found");
  }
  return new Response(null, { status: 204 });
}
