import { data, redirect } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/feed";
import { getSessionUser } from "~/lib/auth.server";
import { listSocialFeed } from "~/lib/activities.server";
import { ClientDate } from "~/components/ClientDate";
import { ClientMap } from "~/components/ClientMap";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");

  const rows = await listSocialFeed(user.id, 50);
  return data({
    activities: rows.map((a) => ({
      id: a.id,
      name: a.name,
      distance: a.distance,
      elevationGain: a.elevationGain,
      duration: a.duration,
      startedAt: a.startedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      geojson: a.geojson ?? null,
      ownerUsername: a.ownerUsername,
      ownerDisplayName: a.ownerDisplayName,
    })),
  });
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Feed — trails.cool" }];
}

export default function Feed({ loaderData }: Route.ComponentProps) {
  const { activities } = loaderData;
  const { t } = useTranslation("journal");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">{t("social.feed.heading")}</h1>

      {activities.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-gray-500">{t("social.feed.empty")}</p>
          <a
            href="/"
            className="mt-3 inline-block text-sm text-blue-600 hover:underline"
          >
            {t("social.feed.publicFeedLink")}
          </a>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {activities.map((a) => (
            <li key={a.id}>
              <a
                href={`/activities/${a.id}`}
                className="block rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
              >
                <div className="flex gap-4">
                  <div className="w-40 shrink-0">
                    {a.geojson ? (
                      <ClientMap geojson={a.geojson} />
                    ) : (
                      <div className="flex h-28 w-full items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                        {t("routes.noMapPreview")}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <h3 className="text-base font-medium text-gray-900">{a.name}</h3>
                      <div className="mt-1 text-sm text-gray-500">
                        <a
                          href={`/users/${a.ownerUsername}`}
                          className="hover:text-gray-700 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {a.ownerDisplayName ?? a.ownerUsername}
                        </a>
                        {" · "}
                        <ClientDate iso={a.startedAt ?? a.createdAt} />
                      </div>
                      <div className="mt-1 flex gap-4 text-sm text-gray-500">
                        {a.distance != null && (
                          <span>{(a.distance / 1000).toFixed(1)} km</span>
                        )}
                        {a.elevationGain != null && (
                          <span>↑ {Math.round(a.elevationGain)} m</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
