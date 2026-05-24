import { data } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/activities._index";
import { requireSessionUser } from "~/lib/auth/session.server";
import { listActivities } from "~/lib/activities.server";
import { ClientDate } from "~/components/ClientDate";
import { ClientMap } from "~/components/ClientMap";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireSessionUser(request);

  const url = new URL(request.url);
  const sortParam = url.searchParams.get("sort");
  const activitySort = sortParam === "addedAt" ? "addedAt" : ("startedAt" as const);

  const userActivities = await listActivities(user.id, activitySort);
  return data({
    activitySort,
    activities: userActivities.map((a) => ({
      id: a.id,
      name: a.name,
      distance: a.distance,
      elevationGain: a.elevationGain,
      duration: a.duration,
      startedAt: a.startedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      geojson: a.geojson ?? null,
    })),
  });
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Activities — trails.cool" }];
}

export default function ActivitiesListPage({ loaderData }: Route.ComponentProps) {
  const { activities, activitySort } = loaderData;
  const { t } = useTranslation("journal");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("activities.title")}</h1>
        <div className="flex items-center gap-2">
          {activities.length > 0 && (
            <div className="flex items-center gap-1 rounded-md border border-gray-200 p-0.5 text-sm">
              <a
                href="?sort=startedAt"
                className={`rounded px-2.5 py-1 ${activitySort === "startedAt" ? "bg-gray-100 font-medium text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                {t("activities.sortByDate")}
              </a>
              <a
                href="?sort=addedAt"
                className={`rounded px-2.5 py-1 ${activitySort === "addedAt" ? "bg-gray-100 font-medium text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                {t("activities.sortByAdded")}
              </a>
            </div>
          )}
          <a
            href="/activities/new"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            New Activity
          </a>
        </div>
      </div>

      {activities.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">
          No activities yet. Record your first adventure!
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {activities.map((activity) => (
            <li key={activity.id}>
              <a
                href={`/activities/${activity.id}`}
                className="block rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
              >
                <div className="flex gap-4">
                  <div className="w-48 shrink-0">
                    {activity.geojson ? (
                      <ClientMap geojson={activity.geojson} />
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                        {t("routes.noMapPreview")}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <h2 className="text-lg font-medium text-gray-900">{activity.name}</h2>
                      <div className="mt-1 flex gap-4 text-sm text-gray-500">
                        {activity.distance != null && (
                          <span>{(activity.distance / 1000).toFixed(1)} km</span>
                        )}
                        {activity.elevationGain != null && (
                          <span>↑ {activity.elevationGain} m</span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-400">
                      <ClientDate iso={activity.startedAt ?? activity.createdAt} />
                    </span>
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
