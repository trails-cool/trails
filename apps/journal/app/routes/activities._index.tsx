import { data, redirect } from "react-router";
import type { Route } from "./+types/activities._index";
import { getSessionUser } from "~/lib/auth.server";
import { listActivities } from "~/lib/activities.server";
import { ClientDate } from "~/components/ClientDate";

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
    })),
  });
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Activities — trails.cool" }];
}

export default function ActivitiesListPage({ loaderData }: Route.ComponentProps) {
  const { activities } = loaderData;

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
        <ul className="mt-6 divide-y divide-gray-200">
          {activities.map((activity) => (
            <li key={activity.id}>
              <a
                href={`/activities/${activity.id}`}
                className="block py-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900">{activity.name}</h2>
                  <span className="text-sm text-gray-500">
                    <ClientDate iso={activity.startedAt ?? activity.createdAt} />
                  </span>
                </div>
                <div className="mt-1 flex gap-4 text-sm text-gray-500">
                  {activity.distance != null && (
                    <span>{(activity.distance / 1000).toFixed(1)} km</span>
                  )}
                  {activity.elevationGain != null && (
                    <span>↑ {activity.elevationGain} m</span>
                  )}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
