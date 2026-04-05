import { data, redirect } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/activities.$id";
import { getSessionUser } from "~/lib/auth.server";
import { getActivity, deleteActivity, linkActivityToRoute, createRouteFromActivity } from "~/lib/activities.server";
import { deleteImportByActivity } from "~/lib/sync/imports.server";
import { listRoutes } from "~/lib/routes.server";
import { ClientDate } from "~/components/ClientDate";
import { ClientMap } from "~/components/ClientMap";

export async function loader({ params, request }: Route.LoaderArgs) {
  const activity = await getActivity(params.id);
  if (!activity) throw data({ error: "Activity not found" }, { status: 404 });

  const user = await getSessionUser(request);
  const isOwner = user?.id === activity.ownerId;

  const userRoutes = isOwner && user ? await listRoutes(user.id) : [];

  return data({
    activity: {
      id: activity.id,
      name: activity.name,
      description: activity.description,
      distance: activity.distance,
      elevationGain: activity.elevationGain,
      elevationLoss: activity.elevationLoss,
      duration: activity.duration,
      routeId: activity.routeId,
      hasGpx: !!activity.gpx,
      geojson: activity.geojson ?? null,
      startedAt: activity.startedAt?.toISOString() ?? null,
      createdAt: activity.createdAt.toISOString(),
      importSource: activity.importSource,
    },
    isOwner,
    routes: userRoutes.map((r) => ({ id: r.id, name: r.name })),
  });
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "link-route") {
    const routeId = formData.get("routeId") as string;
    if (routeId) {
      await linkActivityToRoute(params.id, routeId, user.id);
    }
    return redirect(`/activities/${params.id}`);
  }

  if (intent === "create-route") {
    const routeId = await createRouteFromActivity(params.id, user.id);
    if (routeId) return redirect(`/routes/${routeId}`);
    return data({ error: "No GPX data to create route from" }, { status: 400 });
  }

  if (intent === "delete") {
    await deleteImportByActivity(params.id);
    const deleted = await deleteActivity(params.id, user.id);
    if (deleted) return redirect("/activities");
    return data({ error: "Activity not found" }, { status: 404 });
  }

  return data({ error: "Unknown action" }, { status: 400 });
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  const name = (loaderData as { activity: { name: string } })?.activity?.name ?? "Activity";
  return [{ title: `${name} — trails.cool` }];
}

export default function ActivityDetailPage({ loaderData }: Route.ComponentProps) {
  const { activity, isOwner, routes } = loaderData;
  const { t } = useTranslation("journal");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{activity.name}</h1>
        {activity.importSource && (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {t("activities.importedFrom", { provider: activity.importSource.provider })}
          </span>
        )}
      </div>
      {activity.description && (
        <p className="mt-2 text-gray-600">{activity.description}</p>
      )}

      <div className="mt-2 text-sm text-gray-500">
        <ClientDate iso={activity.startedAt ?? activity.createdAt} />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {activity.distance != null && (
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-2xl font-bold text-gray-900">
              {(activity.distance / 1000).toFixed(1)} km
            </p>
            <p className="text-sm text-gray-500">Distance</p>
          </div>
        )}
        {activity.elevationGain != null && (
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-2xl font-bold text-gray-900">↑ {activity.elevationGain} m</p>
            <p className="text-sm text-gray-500">Ascent</p>
          </div>
        )}
        {activity.elevationLoss != null && (
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-2xl font-bold text-gray-900">↓ {activity.elevationLoss} m</p>
            <p className="text-sm text-gray-500">Descent</p>
          </div>
        )}
      </div>

      {activity.geojson && (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200" style={{ height: 400 }}>
          <ClientMap geojson={activity.geojson} interactive className="h-full w-full" />
        </div>
      )}

      {activity.routeId && (
        <div className="mt-6">
          <a href={`/routes/${activity.routeId}`} className="text-blue-600 hover:underline">
            View linked route →
          </a>
        </div>
      )}

      {isOwner && !activity.routeId && (
        <div className="mt-8 space-y-4 border-t border-gray-200 pt-6">
          {routes.length > 0 && (
            <form method="post" className="flex items-end gap-3">
              <input type="hidden" name="intent" value="link-route" />
              <div className="flex-1">
                <label htmlFor="routeId" className="block text-sm font-medium text-gray-700">
                  {t("activities.linkToRoute")}
                </label>
                <select
                  id="routeId"
                  name="routeId"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Link
              </button>
            </form>
          )}

          {activity.hasGpx && (
            <form method="post">
              <input type="hidden" name="intent" value="create-route" />
              <button
                type="submit"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {t("activities.createRouteFromActivity")}
              </button>
            </form>
          )}
        </div>
      )}

      {isOwner && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <form method="post" onSubmit={(e) => { if (!confirm(t("activities.deleteConfirm"))) e.preventDefault(); }}>
            <input type="hidden" name="intent" value="delete" />
            <button
              type="submit"
              className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              {t("activities.delete")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
