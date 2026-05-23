import { redirect, data } from "react-router";
import type { Route } from "./+types/api.sync.disconnect.$provider";
import { getSessionUser } from "~/lib/auth/session.server";
import { getManifest, unlinkByUserProvider } from "~/lib/connected-services";

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const manifest = getManifest(params.provider);
  if (!manifest) return data({ error: "Unknown provider" }, { status: 404 });

  // unlinkByUserProvider best-effort revokes at the provider, then deletes
  // the local row regardless of revoke outcome. Imported activities are
  // retained (FK is set null on imports.activityId, not cascaded).
  await unlinkByUserProvider(user.id, manifest.id);

  const referer = request.headers.get("referer");
  const url = referer ? new URL(referer) : null;
  let back = "/settings/connections";
  if (url?.pathname.startsWith("/settings") && !url.pathname.startsWith("/settings/connections/")) {
    back = url.pathname;
  }
  return redirect(back);
}
