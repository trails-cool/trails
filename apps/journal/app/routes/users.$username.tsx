import { data } from "react-router";
import type { Route } from "./+types/users.$username";
import { useTranslation } from "react-i18next";
import { ClientDate } from "~/components/ClientDate";
import { FollowButton } from "~/components/FollowButton";
import { SportBadge } from "~/components/SportBadge";
import { loadUserProfile } from "./users.$username.server";
import {
  federationEnabled,
  wantsActivityJson,
  handleFederationRequest,
} from "~/lib/federation.server";

// Content negotiation: this URL is both the human profile (HTML) and the
// ActivityPub actor IRI (application/activity+json). AP clients are
// short-circuited to Fedify before the HTML loader runs; browsers fall
// through untouched.
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request }, next) => {
    if (federationEnabled() && wantsActivityJson(request)) {
      return handleFederationRequest(request);
    }
    return next();
  },
];

export async function loader({ params, request }: Route.LoaderArgs) {
  return data(await loadUserProfile(request, params.username));
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
  const { user, routes, activities, activitySort, isOwn, isDemoUser, followers, following, followState, isLoggedIn, canSeeContent } = loaderData;
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
            {loaderData.profileVisibility === "private" && !isOwn && (
              <span
                className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700"
                title={t("profile.lockedTitle")}
              >
                🔒 {t("profile.lockedBadge")}
              </span>
            )}
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
            {canSeeContent ? (
              <a
                href={`/users/${user.username}/followers`}
                className="hover:text-gray-900 hover:underline"
              >
                <span className="font-semibold text-gray-900">{followers}</span>{" "}
                {t("social.followers.label")}
              </a>
            ) : (
              <span>
                <span className="font-semibold text-gray-900">{followers}</span>{" "}
                {t("social.followers.label")}
              </span>
            )}
            {canSeeContent ? (
              <a
                href={`/users/${user.username}/following`}
                className="hover:text-gray-900 hover:underline"
              >
                <span className="font-semibold text-gray-900">{following}</span>{" "}
                {t("social.following.label")}
              </a>
            ) : (
              <span>
                <span className="font-semibold text-gray-900">{following}</span>{" "}
                {t("social.following.label")}
              </span>
            )}
          </div>
        </div>
        {!isOwn && isLoggedIn && (
          <FollowButton
            username={user.username}
            isPrivateTarget={loaderData.profileVisibility === "private"}
            initialState={followState}
          />
        )}
      </div>

      {!canSeeContent && (
        <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-2xl" aria-hidden="true">🔒</p>
          <p className="mt-2 text-sm font-medium text-gray-900">
            {t("profile.privateStub.heading")}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {isLoggedIn
              ? t("profile.privateStub.bodyAuth")
              : t("profile.privateStub.bodyAnon")}
          </p>
          {!isLoggedIn && (
            <a
              href="/auth/login"
              className="mt-4 inline-block rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("auth.login")}
            </a>
          )}
        </div>
      )}

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

      {canSeeContent && (
        <>
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
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("activities.title")} ({activities.length})
          </h2>
          {activities.length > 0 && (
            <div className="flex items-center gap-1 rounded-md border border-gray-200 p-0.5 text-sm">
              <a
                href={`?sort=startedAt`}
                className={`rounded px-2.5 py-1 ${activitySort === "startedAt" ? "bg-gray-100 font-medium text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                {t("activities.sortByDate")}
              </a>
              <a
                href={`?sort=addedAt`}
                className={`rounded px-2.5 py-1 ${activitySort === "addedAt" ? "bg-gray-100 font-medium text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                {t("activities.sortByAdded")}
              </a>
            </div>
          )}
        </div>
        {activities.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{t("profile.noPublicActivities")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-200 rounded-md border border-gray-200">
            {activities.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <a href={`/activities/${a.id}`} className="block hover:bg-gray-50">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="flex items-baseline gap-2">
                      <span className="font-medium text-gray-900">{a.name}</span>
                      <SportBadge sportType={a.sportType} />
                    </span>
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
        </>
      )}
    </div>
  );
}
