// Server-only loader/action for /routes/new. See `home.server.ts`.

import { data, redirect } from "react-router";
import { requireSessionUser } from "~/lib/auth/session.server";
import { createRoute } from "~/lib/routes.server";

export async function loadRoutesNew(request: Request) {
  await requireSessionUser(request);
  return {};
}

export async function routesNewAction(request: Request) {
  const user = await requireSessionUser(request);

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const gpxFile = formData.get("gpx") as File | null;

  if (!name) return data({ error: "Name is required" }, { status: 400 });

  let gpx: string | undefined;
  if (gpxFile && gpxFile.size > 0) {
    gpx = await gpxFile.text();
  }

  const routeId = await createRoute(user.id, { name, description, gpx });
  return redirect(`/routes/${routeId}`);
}
