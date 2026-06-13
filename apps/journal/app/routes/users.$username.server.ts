// Server-only loader for the user profile page. Splitting this out keeps
// the route component file free of direct DB/auth/follow imports — see
// `home.server.ts` for the pattern.

import { data } from "react-router";
import { eq } from "drizzle-orm";
import { getDb } from "~/lib/db";
import { users } from "@trails-cool/db/schema/journal";
import { getSessionUser } from "~/lib/auth/session.server";
import { listPublicRoutesForOwner } from "~/lib/routes.server";
import { listPublicActivitiesForOwner, getActivityStats } from "~/lib/activities.server";
import { loadPersona } from "~/lib/demo-bot.server";
import { countFollowers, countFollowing, getFollowState } from "~/lib/follow.server";

export async function loadUserProfile(request: Request, username: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.username, username));

  if (!user) {
    throw data({ error: "User not found" }, { status: 404 });
  }

  const currentUser = await getSessionUser(request);
  const isOwn = currentUser?.id === user.id;

  // Follow state: null when anonymous or owner; { following, pending }
  // otherwise.
  const followState = !isOwn && currentUser
    ? await getFollowState(currentUser.id, user.username)
    : null;

  // Locked-account model: a private profile renders a stub for
  // non-followers (anonymous OR signed-in but not an accepted follower).
  // Owners always see their own profile in full.
  const canSeeContent =
    isOwn ||
    user.profileVisibility === "public" ||
    (followState !== null && followState.following === true);

  // For private-stub viewers we still want counts (cheap) but skip the
  // expensive content fetches.
  const [followers, following] = await Promise.all([
    countFollowers(user.id),
    countFollowing(user.id),
  ]);
  const url = new URL(request.url);
  const sortParam = url.searchParams.get("sort");
  const activitySort = sortParam === "addedAt" ? "addedAt" : "startedAt";

  const [publicRoutes, publicActivities] = canSeeContent
    ? await Promise.all([
        listPublicRoutesForOwner(user.id),
        listPublicActivitiesForOwner(user.id, activitySort),
      ])
    : [[], []];

  // Roll-up scoped to what this viewer may see (public-only for non-owners).
  // Skipped for the locked stub, which shows no content.
  const stats = canSeeContent
    ? await getActivityStats(user.id, { publicOnly: !isOwn })
    : null;

  // Demo-account badge: true when this profile matches the instance's
  // configured demo persona username. Computed server-side so we don't
  // ship the persona config through client HTML.
  const isDemoUser = user.username === loadPersona().username;

  return {
    user: {
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      domain: user.domain,
      createdAt: user.createdAt.toISOString(),
    },
    routes: publicRoutes.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      distance: r.distance,
      elevationGain: r.elevationGain,
      updatedAt: r.updatedAt.toISOString(),
    })),
    activities: publicActivities.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      sportType: a.sportType,
      distance: a.distance,
      duration: a.duration,
      startedAt: a.startedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
    stats,
    activitySort,
    isOwn,
    isDemoUser,
    followers,
    following,
    followState,
    isLoggedIn: currentUser !== null,
    profileVisibility: user.profileVisibility,
    canSeeContent,
  };
}
