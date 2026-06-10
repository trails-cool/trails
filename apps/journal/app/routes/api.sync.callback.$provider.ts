import { redirect, data } from "react-router";
import type { Route } from "./+types/api.sync.callback.$provider";
import { requireSessionUser } from "~/lib/auth/session.server";
import { getManifest } from "~/lib/connected-services";
import {
  completeOAuthFlow,
  clearPkceCookieHeader,
} from "~/lib/connected-services/oauth-flow.server";
import { pushRouteToProvider } from "~/lib/connected-services/push-action.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireSessionUser(request);

  const manifest = getManifest(params.provider);
  if (!manifest || !manifest.exchangeCode) {
    return data({ error: "Unknown provider" }, { status: 404 });
  }

  const result = await completeOAuthFlow(manifest, request, user.id);
  const state = result.state;
  const fallbackReturn = state.returnTo ?? "/settings";
  // Spent (or irrelevant) verifier — clear it on every outcome.
  const headers = { "Set-Cookie": clearPkceCookieHeader() };

  switch (result.status) {
    case "denied":
      // User declined at the provider. Back to the originating page
      // with a notice instead of looping them through OAuth again.
      return redirect(`${fallbackReturn}?push=needs_permission`, { headers });
    case "missing_code":
      return data({ error: "Missing authorization code" }, { status: 400 });
    case "missing_verifier":
      return redirect(`${fallbackReturn}?error=sync_failed`, { headers });
    case "error":
      return redirect(`${fallbackReturn}?error=${result.code}`, { headers });
    case "linked":
      break;
  }

  // Resume an interrupted push now that the connection has the scope.
  if (state.pushAfter?.routeId) {
    const outcome = await pushRouteToProvider({
      userId: user.id,
      providerId: manifest.id,
      routeId: state.pushAfter.routeId,
    });
    const target = state.returnTo ?? `/routes/${state.pushAfter.routeId}`;
    if (outcome.status === "success") return redirect(`${target}?push=success`, { headers });
    if (outcome.status === "scope_missing") return redirect(`${target}?push=needs_permission`, { headers });
    if (outcome.status === "needs_relink") return redirect(`${target}?push=needs_permission`, { headers });
    if (outcome.status === "error") return redirect(`${target}?push=error&code=${outcome.code}`, { headers });
    return redirect(`${target}?push=${outcome.status}`, { headers });
  }

  return redirect(state.returnTo ?? "/settings", { headers });
}
