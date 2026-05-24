// Server-only loader for /settings/account. See `home.server.ts`.

import { redirect } from "react-router";
import { getSessionUser } from "~/lib/auth/session.server";

export async function loadAccountSettings(request: Request) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");
  return {
    user: {
      username: user.username,
      email: user.email,
    },
  };
}
