import { redirect, data } from "react-router";
import type { Route } from "./+types/api.sync.connect.$provider";
import { getSessionUser } from "~/lib/auth.server";
import { getProvider } from "~/lib/sync/registry";
import { encodeOAuthState } from "~/lib/sync/pushes.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const provider = getProvider(params.provider);
  if (!provider) return data({ error: "Unknown provider" }, { status: 404 });

  const origin = process.env.ORIGIN ?? "http://localhost:3000";
  const redirectUri = `${origin}/api/sync/callback/${params.provider}`;
  const state = encodeOAuthState({ returnTo: "/settings/connections" });

  return redirect(provider.getAuthUrl(redirectUri, state));
}
