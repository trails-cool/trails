import { data, redirect } from "react-router";
import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/activities._index";
import { getSessionUser } from "~/lib/auth.server";
import { listActivities } from "~/lib/activities.server";
import { ClientDate } from "~/components/ClientDate";

const RouteMapThumbnail = lazy(() =>
  import("~/components/RouteMapThumbnail").then((m) => ({ default: m.RouteMapThumbnail })),
);

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const userActivities = await listActivities(user.id);
  return data({
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
  const { activities } = loaderData;
  const { t } = useTranslation("journal");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Activities</h1>
        <a
          href="/activities/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          New Activity
        </a>
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
                      <Suspense fallback={<div className="h-36 w-full animate-pulse rounded bg-gray-100" />}>
                        <RouteMapThumbnail geojson={activity.geojson} />
                      </Suspense>
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
