// Server-only loader/action for /activities/:id. See `home.server.ts`.

import { data, redirect } from "react-router";
import { canView } from "~/lib/auth.server";
import { getSessionUser, requireSessionUser } from "~/lib/auth/session.server";
import {
  getActivity,
  deleteActivity,
  linkActivityToRoute,
  createRouteFromActivity,
  updateActivityVisibility,
} from "~/lib/activities.server";
import { deleteImportByActivity } from "~/lib/sync/imports.server";
import { listRoutes } from "~/lib/routes.server";
import type { Visibility } from "@trails-cool/db/schema/journal";

const VISIBILITY_VALUES = new Set<Visibility>(["private", "unlisted", "public"]);

export async function loadActivityDetail(request: Request, id: string | undefined) {
  const activity = await getActivity(id ?? "");
  if (!activity) throw data({ error: "Activity not found" }, { status: 404 });

  const user = await getSessionUser(request);
  const isOwner = user?.id === activity.ownerId;

  // Visibility gate — public always, unlisted on direct link, private owner-only.
  // 404 (not 403) to avoid leaking existence.
  if (!canView(activity, user, { asDirectLink: true })) {
    throw data({ error: "Activity not found" }, { status: 404 });
  }

  const userRoutes = isOwner && user ? await listRoutes(user.id) : [];

  return {
    activity: {
      id: activity.id,
      name: activity.name,
      description: activity.description,
      distance: activity.distance,
      elevationGain: activity.elevationGain,
      elevationLoss: activity.elevationLoss,
      duration: activity.duration,
      routeId: activity.routeId,
      hasGpx: !!activity.gpx,
      geojson: activity.geojson ?? null,
      startedAt: activity.startedAt?.toISOString() ?? null,
      visibility: activity.visibility,
      createdAt: activity.createdAt.toISOString(),
      importSource: activity.importSource,
    },
    isOwner,
    routes: userRoutes.map((r) => ({ id: r.id, name: r.name })),
  };
}

export async function activityDetailAction(request: Request, id: string | undefined) {
  const user = await requireSessionUser(request);
  const activityId = id ?? "";

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "link-route") {
    const routeId = formData.get("routeId") as string;
    if (routeId) {
      await linkActivityToRoute(activityId, routeId, user.id);
    }
    return redirect(`/activities/${activityId}`);
  }

  if (intent === "create-route") {
    const routeId = await createRouteFromActivity(activityId, user.id);
    if (routeId) return redirect(`/routes/${routeId}`);
    return data({ error: "No GPX data to create route from" }, { status: 400 });
  }

  if (intent === "delete") {
    await deleteImportByActivity(activityId);
    const deleted = await deleteActivity(activityId, user.id);
    if (deleted) return redirect("/activities");
    return data({ error: "Activity not found" }, { status: 404 });
  }

  if (intent === "set-visibility") {
    const raw = formData.get("visibility") as string | null;
    if (!raw || !VISIBILITY_VALUES.has(raw as Visibility)) {
      return data({ error: "Invalid visibility" }, { status: 400 });
    }
    const ok = await updateActivityVisibility(activityId, user.id, raw as Visibility);
    if (!ok) return data({ error: "Activity not found" }, { status: 404 });
    return redirect(`/activities/${activityId}`);
  }

  return data({ error: "Unknown action" }, { status: 400 });
}
