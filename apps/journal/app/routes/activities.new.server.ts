// Server-only loader/action for /activities/new. See `home.server.ts`.

import { data, redirect } from "react-router";
import { requireSessionUser } from "~/lib/auth/session.server";
import { createActivity } from "~/lib/activities.server";
import { listRoutes } from "~/lib/routes.server";
import { SPORT_TYPES } from "@trails-cool/db/schema/journal";
import type { SportType } from "@trails-cool/db/schema/journal";

export async function loadActivitiesNew(request: Request) {
  const user = await requireSessionUser(request);

  const userRoutes = await listRoutes(user.id);
  return {
    routes: userRoutes.map((r) => ({ id: r.id, name: r.name })),
  };
}

export async function activitiesNewAction(request: Request) {
  const user = await requireSessionUser(request);

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const routeId = formData.get("routeId") as string | null;
  const sportRaw = formData.get("sportType");
  const gpxFile = formData.get("gpx") as File | null;

  if (!name) return data({ error: "Name is required" }, { status: 400 });

  // Empty/absent selection → unspecified; anything else must be a known value.
  const sportType =
    typeof sportRaw === "string" && (SPORT_TYPES as readonly string[]).includes(sportRaw)
      ? (sportRaw as SportType)
      : undefined;

  let gpx: string | undefined;
  if (gpxFile && gpxFile.size > 0) {
    gpx = await gpxFile.text();
  }

  const activityId = await createActivity(user.id, {
    name,
    description,
    sportType,
    gpx,
    routeId: routeId || undefined,
  });

  return redirect(`/activities/${activityId}`);
}
