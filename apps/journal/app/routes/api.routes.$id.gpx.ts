import type { Route } from "./+types/api.routes.$id.gpx";
import { getRouteWithVersions } from "~/lib/routes.server";

export async function loader({ params }: Route.LoaderArgs) {
  const route = await getRouteWithVersions(params.id);
  if (!route?.gpx) {
    return new Response("No GPX data", { status: 404 });
  }

  return new Response(route.gpx, {
    headers: {
      "Content-Type": "application/gpx+xml",
      "Content-Disposition": `attachment; filename="${route.name.replace(/[^a-z0-9]/gi, "_")}.gpx"`,
    },
  });
}
