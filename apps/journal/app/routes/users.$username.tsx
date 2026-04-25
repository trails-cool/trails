import { data } from "react-router";
import type { Route } from "./+types/users.$username";
import { useTranslation } from "react-i18next";
import { getDb } from "~/lib/db";
import { users } from "@trails-cool/db/schema/journal";
import { eq } from "drizzle-orm";
import { getSessionUser } from "~/lib/auth.server";
import { listPublicRoutesForOwner } from "~/lib/routes.server";
import { listPublicActivitiesForOwner } from "~/lib/activities.server";
import { loadPersona } from "~/lib/demo-bot.server";
import { countFollowers, countFollowing, getFollowState } from "~/lib/follow.server";
import { ClientDate } from "~/components/ClientDate";
import { FollowButton } from "~/components/FollowButton";

export async function loader({ params, request }: Route.LoaderArgs) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.username, params.username));

  if (!user) {
    throw data({ error: "User not found" }, { status: 404 });
  }

  const [publicRoutes, publicActivities, currentUser, followers, following] = await Promise.all([
    listPublicRoutesForOwner(user.id),
    listPublicActivitiesForOwner(user.id),
    getSessionUser(request),
    countFollowers(user.id),
    countFollowing(user.id),
  ]);

  const isOwn = currentUser?.id === user.id;

  // Profile-visibility gate: a `private` profile 404s for everyone but
  // the owner, regardless of how much public content they have. With
  // explicit `profile_visibility` we no longer 404 public profiles that
  // happen to have zero public items — the page renders with empty
  // sections, matching Mastodon-style "discoverable account, no posts
  // yet" behavior. Existence-leak risk is accepted: explicit visibility
  // is the contract.
  if (!isOwn && user.profileVisibility !== "public") {
    throw data({ error: "User not found" }, { status: 404 });
  }

  // Follow state for non-owner viewers (null when anonymous).
  const followState = !isOwn && currentUser
    ? await getFollowState(currentUser.id, user.username)
    : null;

  // Demo-account badge: true when this profile matches the instance's
  // configured demo persona username. Computed server-side so we don't
  // ship the persona config through client HTML.
  const isDemoUser = user.username === loadPersona().username;

  return data({
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
      distance: a.distance,
      duration: a.duration,
      startedAt: a.startedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
    isOwn,
    isDemoUser,
    followers,
    following,
    followState,
    isLoggedIn: currentUser !== null,
    profileVisibility: user.profileVisibility,
  });
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  const user = (loaderData as { user?: { username: string; displayName: string | null; domain: string; bio: string | null } })?.user;
  const displayName = user?.displayName ?? user?.username ?? "Profile";
  const title = `${displayName} (@${user?.username}) — trails.cool`;
  const description = user?.bio && user.bio.length > 0
    ? user.bio.slice(0, 280)
    : `${displayName} on trails.cool`;

  if (!user) return [{ title }];
  return [
    { title },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "profile" },
    { property: "og:site_name", content: "trails.cool" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
}

export default function UserProfilePage({ loaderData }: Route.ComponentProps) {
  const { user, routes, activities, isOwn, isDemoUser, followers, following, followState, isLoggedIn } = loaderData;
  const { t } = useTranslation("journal");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
          {user.username[0]?.toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">
              {user.displayName ?? user.username}
            </h1>
            {isDemoUser && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {t("demo.badge")}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            @{user.username}@{user.domain}
          </p>
          {user.bio && <p className="mt-2 text-gray-700">{user.bio}</p>}
          <div className="mt-2 flex gap-4 text-sm text-gray-600">
            <a
              href={`/users/${user.username}/followers`}
              className="hover:text-gray-900 hover:underline"
            >
              <span className="font-semibold text-gray-900">{followers}</span>{" "}
              {t("social.followers.label")}
            </a>
            <a
              href={`/users/${user.username}/following`}
              className="hover:text-gray-900 hover:underline"
            >
              <span className="font-semibold text-gray-900">{following}</span>{" "}
              {t("social.following.label")}
            </a>
          </div>
        </div>
        {!isOwn && isLoggedIn && (
          <FollowButton
            username={user.username}
            initialState={followState}
          />
        )}
      </div>

      {isOwn && loaderData.profileVisibility === "private" && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {t("profile.privateNote")}{" "}
          <a href="/settings" className="underline hover:text-amber-900">
            {t("profile.goToSettings")}
          </a>
        </div>
      )}
      {isOwn && loaderData.profileVisibility === "public" && (
        <div className="mt-6 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
          {t("profile.ownNote")}{" "}
          <a href="/settings" className="underline hover:text-blue-900">
            {t("profile.goToSettings")}
          </a>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("routes.title")} ({routes.length})
        </h2>
        {routes.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{t("profile.noPublicRoutes")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-200 rounded-md border border-gray-200">
            {routes.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <a href={`/routes/${r.id}`} className="block hover:bg-gray-50">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-medium text-gray-900">{r.name}</span>
                    {r.distance != null && (
                      <span className="shrink-0 text-sm tabular-nums text-gray-600">
                        {(r.distance / 1000).toFixed(1)} km
                      </span>
                    )}
                  </div>
                  {r.description && (
                    <p className="mt-1 line-clamp-1 text-sm text-gray-500">{r.description}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    <ClientDate iso={r.updatedAt} />
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("activities.title")} ({activities.length})
        </h2>
        {activities.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{t("profile.noPublicActivities")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-200 rounded-md border border-gray-200">
            {activities.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <a href={`/activities/${a.id}`} className="block hover:bg-gray-50">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-medium text-gray-900">{a.name}</span>
                    {a.distance != null && (
                      <span className="shrink-0 text-sm tabular-nums text-gray-600">
                        {(a.distance / 1000).toFixed(1)} km
                      </span>
                    )}
                  </div>
                  {a.description && (
                    <p className="mt-1 line-clamp-1 text-sm text-gray-500">{a.description}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    <ClientDate iso={a.startedAt ?? a.createdAt} />
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
