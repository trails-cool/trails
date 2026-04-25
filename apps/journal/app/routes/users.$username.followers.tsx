import { data } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/users.$username.followers";
import { getDb } from "~/lib/db";
import { users } from "@trails-cool/db/schema/journal";
import { listFollowers, countFollowers, getFollowState } from "~/lib/follow.server";
import { getSessionUser } from "~/lib/auth.server";
import { CollectionPage } from "~/components/CollectionPage";

export async function loader({ params, request }: Route.LoaderArgs) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.username, params.username));
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

  return data({
    user: { username: user.username, displayName: user.displayName },
    page,
    total,
    entries,
  });
}

export function meta({ data: d }: Route.MetaArgs) {
  return [{ title: `Followers of @${d?.user.username ?? ""} — trails.cool` }];
}

export default function Followers({ loaderData }: Route.ComponentProps) {
  return <CollectionPage kind="followers" {...loaderData} />;
}
