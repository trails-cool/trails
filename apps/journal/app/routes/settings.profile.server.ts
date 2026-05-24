// Server-only loader for /settings/profile. See `home.server.ts`.

import { redirect } from "react-router";
import { getSessionUser } from "~/lib/auth/session.server";

export async function loadProfileSettings(request: Request) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");
  return {
    user: {
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      profileVisibility: user.profileVisibility,
    },
  };
}
