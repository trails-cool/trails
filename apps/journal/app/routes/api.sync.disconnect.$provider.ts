import { redirect, data } from "react-router";
import type { Route } from "./+types/api.sync.disconnect.$provider";
import { getSessionUser } from "~/lib/auth.server";
import { getProvider } from "~/lib/sync/registry";
import { deleteConnection } from "~/lib/sync/connections.server";

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const provider = getProvider(params.provider);
  if (!provider) return data({ error: "Unknown provider" }, { status: 404 });

  await deleteConnection(user.id, provider.id);
  return redirect("/settings");
}
