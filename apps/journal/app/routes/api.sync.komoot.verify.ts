// POST /api/sync/komoot/verify
// Verifies Komoot public profile ownership by checking that the user's
// trails.cool profile URL appears in their Komoot bio.
// On success, creates or replaces the connected service row in public mode.

import { data, redirect } from "react-router";
import { getOrigin } from "~/lib/config.server";
import type { Route } from "./+types/api.sync.komoot.verify";
import { getSessionUser } from "~/lib/auth/session.server";
import { parseKomootUserId, verifyKomootOwnership } from "~/lib/komoot.server";
import { link } from "~/lib/connected-services/manager";
export async function action({ request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const body = (await request.json()) as { komootProfileUrl?: string };
  const input = body.komootProfileUrl?.trim() ?? "";

  const komootUserId = parseKomootUserId(input);
  if (!komootUserId) {
    return data({ error: "invalid_url" }, { status: 400 });
  }

  const origin = getOrigin();
  const trailsProfileUrl = `${origin}/users/${user.username}`;

  const verified = await verifyKomootOwnership(komootUserId, trailsProfileUrl);
  if (!verified) {
    return data({ error: "not_verified" }, { status: 422 });
  }

  await link({
    userId: user.id,
    provider: "komoot",
    credentialKind: "public",
    credentials: { mode: "public", komootUserId },
    providerUserId: komootUserId,
    grantedScopes: [],
  });

  return data({ success: true });
}
