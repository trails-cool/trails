import { data } from "react-router";
import type { Route } from "./+types/api.sync.connect.$provider";
import { requireSessionUser } from "~/lib/auth/session.server";
import { getManifest } from "~/lib/connected-services";
import { initiateOAuthFlow } from "~/lib/connected-services/oauth-flow.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireSessionUser(request);

  const manifest = getManifest(params.provider);
  if (!manifest || !manifest.buildAuthUrl) {
    return data({ error: "Unknown provider" }, { status: 404 });
  }

  return initiateOAuthFlow(manifest, { returnTo: "/settings/connections" });
}
