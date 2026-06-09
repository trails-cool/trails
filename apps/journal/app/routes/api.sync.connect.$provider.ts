import { redirect, data } from "react-router";
import { getOrigin } from "~/lib/config.server";
import type { Route } from "./+types/api.sync.connect.$provider";
import { requireSessionUser } from "~/lib/auth/session.server";
import { getManifest } from "~/lib/connected-services";
import {
  encodeOAuthState,
  generatePkcePair,
  pkceCookieHeader,
} from "~/lib/connected-services/oauth-state.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireSessionUser(request);

  const manifest = getManifest(params.provider);
  if (!manifest || !manifest.buildAuthUrl) {
    return data({ error: "Unknown provider" }, { status: 404 });
  }

  const origin = getOrigin();
  const redirectUri = `${origin}/api/sync/callback/${params.provider}`;
  const state = encodeOAuthState({ returnTo: "/settings/connections" });

  // PKCE providers (Garmin): the verifier crosses the redirect in an
  // httpOnly cookie; only the S256 challenge goes to the provider.
  if (manifest.pkce) {
    const { verifier, challenge } = generatePkcePair();
    return redirect(
      manifest.buildAuthUrl(redirectUri, state, { codeChallenge: challenge }),
      { headers: { "Set-Cookie": pkceCookieHeader(verifier) } },
    );
  }

  return redirect(manifest.buildAuthUrl(redirectUri, state));
}
