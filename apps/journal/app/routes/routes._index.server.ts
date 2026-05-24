// Server-only loader for /routes index. See `home.server.ts`.

import { requireSessionUser } from "~/lib/auth/session.server";
import { listRoutes } from "~/lib/routes.server";

export async function loadRoutesIndex(request: Request) {
  const user = await requireSessionUser(request);

  const userRoutes = await listRoutes(user.id);
  return {
    routes: userRoutes.map((r) => ({
      id: r.id,
      name: r.name,
      distance: r.distance,
      elevationGain: r.elevationGain,
      updatedAt: r.updatedAt.toISOString(),
      geojson: r.geojson ?? null,
    })),
  };
}
