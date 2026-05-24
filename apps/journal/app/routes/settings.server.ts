// Server-only loader for /settings layout. See `home.server.ts`.

import { redirect } from "react-router";
import { getSessionUser } from "~/lib/auth/session.server";

export async function loadSettingsLayout(request: Request) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");
  return { username: user.username };
}
