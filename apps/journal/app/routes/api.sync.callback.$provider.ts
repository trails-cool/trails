import { redirect, data } from "react-router";
import type { Route } from "./+types/api.sync.callback.$provider";
import { getSessionUser } from "~/lib/auth/session.server";
import { getManifest, link } from "~/lib/connected-services";
import {
  decodeOAuthState,
} from "~/lib/connected-services/oauth-state.server";
import { pushRouteToProvider } from "~/lib/connected-services/push-action.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const manifest = getManifest(params.provider);
  if (!manifest || !manifest.exchangeCode) {
    return data({ error: "Unknown provider" }, { status: 404 });
  }

  const url = new URL(request.url);
  const state = decodeOAuthState(url.searchParams.get("state"));
  const fallbackReturn = state.returnTo ?? "/settings";

  // User denied the new scope at Wahoo. Send them back to the originating
  // page with a notice instead of looping them through OAuth again.
  if (url.searchParams.get("error") === "access_denied") {
    return redirect(`${fallbackReturn}?push=needs_permission`);
  }

  const code = url.searchParams.get("code");
  if (!code) return data({ error: "Missing authorization code" }, { status: 400 });

  const origin = process.env.ORIGIN ?? "http://localhost:3000";
  const redirectUri = `${origin}/api/sync/callback/${params.provider}`;

  try {
    const exchange = await manifest.exchangeCode(code, redirectUri);
    await link({
      userId: user.id,
      provider: manifest.id,
      credentialKind: manifest.credentialKind,
      credentials: exchange.credentials as Record<string, unknown>,
      providerUserId: exchange.providerUserId,
      grantedScopes: exchange.grantedScopes,
    });
  } catch (e) {
    console.error(`OAuth callback failed for ${params.provider}:`, e);
    const errCode =
      typeof (e as { code?: string }).code === "string"
        ? (e as { code: string }).code
        : "sync_failed";
    return redirect(`${fallbackReturn}?error=${errCode}`);
  }

  if (state.pushAfter?.routeId) {
    const outcome = await pushRouteToProvider({
      userId: user.id,
      providerId: manifest.id,
      routeId: state.pushAfter.routeId,
    });
    const target = state.returnTo ?? `/routes/${state.pushAfter.routeId}`;
    if (outcome.status === "success") return redirect(`${target}?push=success`);
    if (outcome.status === "scope_missing") return redirect(`${target}?push=needs_permission`);
    if (outcome.status === "needs_relink") return redirect(`${target}?push=needs_permission`);
    if (outcome.status === "error") return redirect(`${target}?push=error&code=${outcome.code}`);
    return redirect(`${target}?push=${outcome.status}`);
  }

  return redirect(state.returnTo ?? "/settings");
}
