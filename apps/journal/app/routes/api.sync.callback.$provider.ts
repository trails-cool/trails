import { redirect, data } from "react-router";
import type { Route } from "./+types/api.sync.callback.$provider";
import { getSessionUser } from "~/lib/auth.server";
import { getProvider } from "~/lib/sync/registry";
import { saveConnection } from "~/lib/sync/connections.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const provider = getProvider(params.provider);
  if (!provider) return data({ error: "Unknown provider" }, { status: 404 });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return data({ error: "Missing authorization code" }, { status: 400 });

  const origin = process.env.ORIGIN ?? "http://localhost:3000";
  const redirectUri = `${origin}/api/sync/callback/${params.provider}`;

  try {
    const tokens = await provider.exchangeCode(code, redirectUri);
    await saveConnection(user.id, provider.id, tokens);
  } catch (e) {
    console.error(`OAuth callback failed for ${params.provider}:`, e);
    return redirect("/settings?error=sync_failed");
  }

  return redirect("/settings");
}
