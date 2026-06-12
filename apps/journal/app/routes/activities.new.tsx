import { data } from "react-router";
import { useTranslation } from "react-i18next";
import { SPORT_TYPES } from "@trails-cool/api";
import type { Route } from "./+types/activities.new";
import { loadActivitiesNew, activitiesNewAction } from "./activities.new.server";

export async function loader({ request }: Route.LoaderArgs) {
  return data(await loadActivitiesNew(request));
}

export async function action({ request }: Route.ActionArgs) {
  return await activitiesNewAction(request);
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "New Activity — trails.cool" }];
}

export default function NewActivityPage({ loaderData }: Route.ComponentProps) {
  const { routes } = loaderData;
  const { t } = useTranslation("journal");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">New Activity</h1>

      <form method="post" encType="multipart/form-data" className="mt-6 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Morning ride in Tiergarten"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="sportType" className="block text-sm font-medium text-gray-700">
            {t("activities.sport.label")}
          </label>
          <select
            id="sportType"
            name="sportType"
            defaultValue=""
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">{t("activities.sport.unspecified")}</option>
            {SPORT_TYPES.map((s) => (
              <option key={s} value={s}>
                {t(`activities.sport.${s}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="gpx" className="block text-sm font-medium text-gray-700">
            GPX file
          </label>
          <input
            id="gpx"
            name="gpx"
            type="file"
            accept=".gpx,application/gpx+xml"
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {routes.length > 0 && (
          <div>
            <label htmlFor="routeId" className="block text-sm font-medium text-gray-700">
              Link to route (optional)
            </label>
            <select
              id="routeId"
              name="routeId"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">None</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Create Activity
          </button>
          <a
            href="/activities"
            className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
