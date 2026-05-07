import { redirect, data } from "react-router";
import type { Route } from "./+types/api.sync.connect.$provider";
import { getSessionUser } from "~/lib/auth.server";
import { getManifest } from "~/lib/connected-services";
import { encodeOAuthState } from "~/lib/connected-services/oauth-state.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const manifest = getManifest(params.provider);
  if (!manifest || !manifest.buildAuthUrl) {
    return data({ error: "Unknown provider" }, { status: 404 });
  }

  const origin = process.env.ORIGIN ?? "http://localhost:3000";
  const redirectUri = `${origin}/api/sync/callback/${params.provider}`;
  const state = encodeOAuthState({ returnTo: "/settings/connections" });

  return redirect(manifest.buildAuthUrl(redirectUri, state));
}
