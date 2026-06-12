// Server-only loader for /feed. See `home.server.ts`.

import { redirect } from "react-router";
import { getSessionUser } from "~/lib/auth/session.server";
import { listSocialFeed, listRecentPublicActivities } from "~/lib/activities.server";

type View = "followed" | "public";

export async function loadFeed(request: Request) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");

  const url = new URL(request.url);
  const view: View = url.searchParams.get("view") === "public" ? "public" : "followed";

  const rows =
    view === "public"
      ? await listRecentPublicActivities(50)
      : await listSocialFeed(user.id, 50);

  return {
    view,
    activities: rows.map((a) => ({
      id: a.id,
      name: a.name,
      sportType: a.sportType,
      distance: a.distance,
      elevationGain: a.elevationGain,
      duration: a.duration,
      startedAt: a.startedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      geojson: a.geojson ?? null,
      ownerUsername: a.ownerUsername,
      ownerDisplayName: a.ownerDisplayName,
      // Remote (federated) attribution — only the followed view can
      // contain remote rows; the public view is local-only.
      ownerDomain: "ownerDomain" in a ? a.ownerDomain : null,
      externalUrl: "externalUrl" in a ? a.externalUrl : null,
      remote: "remote" in a ? a.remote : false,
    })),
  };
}
