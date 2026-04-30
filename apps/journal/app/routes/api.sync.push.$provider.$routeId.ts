import { redirect, data } from "react-router";
import type { Route } from "./+types/api.sync.push.$provider.$routeId";
import { getSessionUser } from "~/lib/auth.server";
import { getProvider } from "~/lib/sync/registry";
import { pushRouteToProvider, encodeOAuthState } from "~/lib/sync/pushes.server";

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const provider = getProvider(params.provider);
  if (!provider) return data({ error: "Unknown provider" }, { status: 404 });

  const returnTo = `/routes/${params.routeId}`;
  const outcome = await pushRouteToProvider({
    userId: user.id,
    providerId: provider.id,
    routeId: params.routeId,
  });

  switch (outcome.status) {
    case "success":
      return redirect(`${returnTo}?push=success`);
    case "scope_missing": {
      const origin = process.env.ORIGIN ?? "http://localhost:3000";
      const redirectUri = `${origin}/api/sync/callback/${provider.id}`;
      const state = encodeOAuthState({
        pushAfter: { routeId: params.routeId },
        returnTo,
      });
      return redirect(provider.getAuthUrl(redirectUri, state));
    }
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
