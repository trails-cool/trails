import { data } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/activities.$id";
import { ClientDate } from "~/components/ClientDate";
import { ClientMap } from "~/components/ClientMap";
import { loadActivityDetail, activityDetailAction } from "./activities.$id.server";
import {
  federationEnabled,
  wantsActivityJson,
  handleFederationRequest,
} from "~/lib/federation.server";

// Content negotiation: this URL doubles as the ActivityPub Note IRI for
// the activity (the id our outbox/push deliveries emit). AP clients get
// the Note object from Fedify's object dispatcher; browsers fall through
// to the HTML page. Same pattern as the actor route (users.$username).
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request }, next) => {
    if (federationEnabled() && wantsActivityJson(request)) {
      return handleFederationRequest(request);
    }
    return next();
  },
];

export async function loader({ params, request }: Route.LoaderArgs) {
  return data(await loadActivityDetail(request, params.id));
}

export async function action({ params, request }: Route.ActionArgs) {
  return await activityDetailAction(request, params.id);
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  const activity = (loaderData as { activity?: { name: string; description: string | null; visibility: string } })?.activity;
  const name = activity?.name ?? "Activity";
  const title = `${name} — trails.cool`;
  const tags: Array<Record<string, string>> = [{ title }];

  if (activity && (activity.visibility === "public" || activity.visibility === "unlisted")) {
    const description = (activity.description && activity.description.length > 0)
      ? activity.description.slice(0, 280)
      : `An activity on trails.cool`;
    tags.push(
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:site_name", content: "trails.cool" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    );
  }

  return tags;
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
          <form method="post" className="flex items-end gap-3">
            <input type="hidden" name="intent" value="set-visibility" />
            <div>
              <label htmlFor="visibility" className="block text-sm font-medium text-gray-700">
                {t("activities.visibility.label")}
              </label>
              <select
                id="visibility"
                name="visibility"
                defaultValue={activity.visibility}
                className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="private">{t("activities.visibility.private")}</option>
                <option value="unlisted">{t("activities.visibility.unlisted")}</option>
                <option value="public">{t("activities.visibility.public")}</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t("routes.saveChanges")}
            </button>
          </form>
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
