// Server-only loader/action for /routes/:id/edit. See `home.server.ts`.

import { data, redirect } from "react-router";
import { requireSessionUser } from "~/lib/auth/session.server";
import { getRoute, updateRoute } from "~/lib/routes.server";
import type { Visibility } from "@trails-cool/db/schema/journal";

const VISIBILITY_VALUES = new Set<Visibility>(["private", "unlisted", "public"]);

export async function loadRouteEdit(request: Request, id: string | undefined) {
  const user = await requireSessionUser(request);

  const route = await getRoute(id ?? "");
  if (!route) throw data({ error: "Route not found" }, { status: 404 });
  if (route.ownerId !== user.id) throw data({ error: "Not authorized" }, { status: 403 });

  return {
    route: {
      id: route.id,
      name: route.name,
      description: route.description,
      visibility: route.visibility,
    },
  };
}

export async function routeEditAction(request: Request, id: string | undefined) {
  const user = await requireSessionUser(request);
  const routeId = id ?? "";

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const gpxFile = formData.get("gpx") as File | null;
  const visibilityRaw = formData.get("visibility") as string | null;

  const input: { name?: string; description?: string; gpx?: string; visibility?: Visibility } = {};
  if (name) input.name = name;
  if (description !== null) input.description = description;
  if (gpxFile && gpxFile.size > 0) {
    input.gpx = await gpxFile.text();
  }
  if (visibilityRaw && VISIBILITY_VALUES.has(visibilityRaw as Visibility)) {
    input.visibility = visibilityRaw as Visibility;
  }

  await updateRoute(routeId, user.id, input);
  return redirect(`/routes/${routeId}`);
}
