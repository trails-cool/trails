// Server-only loader for /users/:username/followers. See `home.server.ts`.

import { data } from "react-router";
import { eq } from "drizzle-orm";
import { getDb } from "~/lib/db";
import { users } from "@trails-cool/db/schema/journal";
import { listFollowers, countFollowers, getFollowState } from "~/lib/follow.server";
import { getSessionUser } from "~/lib/auth/session.server";

export async function loadUserFollowers(request: Request, username: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user) {
    throw data({ error: "User not found" }, { status: 404 });
  }

  // Locked-account model: only the owner and accepted followers can see
  // a private user's followers list. Non-followers (anonymous or signed-in)
  // get the same 404 a stranger sees, mirroring the profile-route policy.
  const currentUser = await getSessionUser(request);
  const isOwn = currentUser?.id === user.id;
  const followState = !isOwn && currentUser
    ? await getFollowState(currentUser.id, user.username)
    : null;
  const canSee =
    isOwn ||
    user.profileVisibility === "public" ||
    (followState !== null && followState.following === true);
  if (!canSee) {
    throw data({ error: "User not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const [entries, total] = await Promise.all([
    listFollowers(user.id, page),
    countFollowers(user.id),
  ]);

  return {
    user: { username: user.username, displayName: user.displayName },
    page,
    total,
    entries,
  };
}
