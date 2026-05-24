import { redirect, data } from "react-router";
import { getOrigin } from "~/lib/config.server";
import type { Route } from "./+types/api.sync.push.$provider.$routeId";
import { getSessionUser } from "~/lib/auth/session.server";
import { getManifest } from "~/lib/connected-services";
import { pushRouteToProvider } from "~/lib/connected-services/push-action.server";
import { encodeOAuthState } from "~/lib/connected-services/oauth-state.server";

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const manifest = getManifest(params.provider);
  if (!manifest) return data({ error: "Unknown provider" }, { status: 404 });

  const returnTo = `/routes/${params.routeId}`;
  const outcome = await pushRouteToProvider({
    userId: user.id,
    providerId: manifest.id,
    routeId: params.routeId,
  });

  switch (outcome.status) {
    case "success":
      return redirect(`${returnTo}?push=success`);
    case "scope_missing": {
      if (!manifest.buildAuthUrl) {
        return redirect(`${returnTo}?push=needs_permission`);
      }
      const origin = getOrigin();
      const redirectUri = `${origin}/api/sync/callback/${manifest.id}`;
      const state = encodeOAuthState({
        pushAfter: { routeId: params.routeId },
        returnTo,
      });
      return redirect(manifest.buildAuthUrl(redirectUri, state));
    }
    case "needs_relink":
      return redirect(`${returnTo}?push=needs_permission`);
    case "no_connection":
      return redirect(`${returnTo}?push=no_connection`);
    case "no_geometry":
      return redirect(`${returnTo}?push=no_geometry`);
    case "not_owner":
      return data({ error: "Forbidden" }, { status: 403 });
    case "not_found":
      return data({ error: "Not found" }, { status: 404 });
    case "unsupported_provider":
      return data({ error: "Provider does not support push" }, { status: 400 });
    case "error":
      return redirect(`${returnTo}?push=error&code=${outcome.code}`);
  }
}

export function loader() {
  return data({ error: "Method not allowed" }, { status: 405 });
}
