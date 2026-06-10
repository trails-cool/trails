import { redirect, data } from "react-router";
import type { Route } from "./+types/api.sync.push.$provider.$routeId";
import { requireSessionUser } from "~/lib/auth/session.server";
import { getManifest } from "~/lib/connected-services";
import { pushRouteToProvider } from "~/lib/connected-services/push-action.server";
import { initiateOAuthFlow } from "~/lib/connected-services/oauth-flow.server";

export async function action({ params, request }: Route.ActionArgs) {
  const user = await requireSessionUser(request);

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
      // Re-authorize with the push intent in the state; the callback
      // resumes the push once the scope is granted.
      return initiateOAuthFlow(manifest, {
        pushAfter: { routeId: params.routeId },
        returnTo,
      });
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
