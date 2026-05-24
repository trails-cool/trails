// Server-only loader for /settings/connections/komoot. See `home.server.ts`.

import { redirect } from "react-router";
import { getOrigin } from "~/lib/config.server";
import { getSessionUser } from "~/lib/auth/session.server";
import { getService } from "~/lib/connected-services/manager";

export async function loadKomootConnection(request: Request) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");

  const service = await getService(user.id, "komoot");
  const origin = getOrigin();
  const trailsProfileUrl = `${origin}/users/${user.username}`;

  return {
    connected: !!service,
    mode: service ? (service.credentials as { mode?: string }).mode ?? null : null,
    providerUserId: service?.providerUserId ?? null,
    serviceId: service?.id ?? null,
    trailsProfileUrl,
  };
}
