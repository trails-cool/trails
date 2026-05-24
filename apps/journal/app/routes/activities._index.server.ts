// Server-only loader for /activities index. See `home.server.ts`.

import { requireSessionUser } from "~/lib/auth/session.server";
import { listActivities } from "~/lib/activities.server";

export async function loadActivitiesIndex(request: Request) {
  const user = await requireSessionUser(request);

  const url = new URL(request.url);
  const sortParam = url.searchParams.get("sort");
  const activitySort = sortParam === "addedAt" ? "addedAt" : ("startedAt" as const);

  const userActivities = await listActivities(user.id, activitySort);
  return {
    activitySort,
    activities: userActivities.map((a) => ({
      id: a.id,
      name: a.name,
      distance: a.distance,
      elevationGain: a.elevationGain,
      duration: a.duration,
      startedAt: a.startedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      geojson: a.geojson ?? null,
    })),
  };
}
