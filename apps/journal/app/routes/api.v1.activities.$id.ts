import type { Route } from "./+types/api.v1.activities.$id";
import { requireApiUser, apiError, apiJson } from "~/lib/api-guard.server";
import { getActivity, deleteActivity } from "~/lib/activities.server";
import { loadOwnedActivity } from "~/lib/ownership.server";
import { ERROR_CODES, ActivityDetailSchema } from "@trails-cool/api";

/** GET /api/v1/activities/:id — full activity detail */
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  const activity = await getActivity(params.id);

  if (!activity || activity.ownerId !== user.id) {
    return apiError(404, ERROR_CODES.NOT_FOUND, "Activity not found");
  }

  return apiJson(ActivityDetailSchema, {
    id: activity.id,
    name: activity.name,
    description: activity.description ?? "",
    sportType: activity.sportType,
    routeId: activity.routeId,
    routeName: null, // TODO: join route name (matches the list endpoint)
    photos: [], // no photos on this surface yet; contract field

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

  const result = await loadOwnedActivity(params.id, user.id);
  if (!result.ok) {
    return apiError(404, ERROR_CODES.NOT_FOUND, "Activity not found");
  }
  await deleteActivity(result.entity);
  return new Response(null, { status: 204 });
}
