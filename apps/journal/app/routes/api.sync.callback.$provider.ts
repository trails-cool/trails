import { redirect, data } from "react-router";
import type { Route } from "./+types/api.sync.callback.$provider";
import { getSessionUser } from "~/lib/auth.server";
import { getProvider } from "~/lib/sync/registry";
import { saveConnection } from "~/lib/sync/connections.server";
import { decodeOAuthState, pushRouteToProvider } from "~/lib/sync/pushes.server";
import { OAuthError } from "~/lib/sync/types";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const provider = getProvider(params.provider);
  if (!provider) return data({ error: "Unknown provider" }, { status: 404 });

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
    const tokens = await provider.exchangeCode(code, redirectUri);
    // Wahoo's token endpoint doesn't return a `scope` field and grants
    // scopes all-or-nothing, so the requested set is the granted set.
    await saveConnection(user.id, provider.id, tokens, provider.scopes);
  } catch (e) {
    console.error(`OAuth callback failed for ${params.provider}:`, e);
    const code = e instanceof OAuthError ? e.code : "sync_failed";
    return redirect(`${fallbackReturn}?error=${code}`);
  }

  if (state.pushAfter?.routeId) {
    const outcome = await pushRouteToProvider({
      userId: user.id,
      providerId: provider.id,
      routeId: state.pushAfter.routeId,
    });
    const target = state.returnTo ?? `/routes/${state.pushAfter.routeId}`;
    if (outcome.status === "success") return redirect(`${target}?push=success`);
    if (outcome.status === "scope_missing") return redirect(`${target}?push=needs_permission`);
    if (outcome.status === "error") return redirect(`${target}?push=error&code=${outcome.code}`);
    return redirect(`${target}?push=${outcome.status}`);
  }

  return redirect(state.returnTo ?? "/settings");
}
