import { data } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/routes.$id.edit";
import { loadRouteEdit, routeEditAction } from "./routes.$id.edit.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  return data(await loadRouteEdit(request, params.id));
}

export async function action({ params, request }: Route.ActionArgs) {
  return await routeEditAction(request, params.id);
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Edit Route — trails.cool" }];
}

export default function EditRoutePage({ loaderData }: Route.ComponentProps) {
  const { route } = loaderData;
  const { t } = useTranslation("journal");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Edit Route</h1>

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
            defaultValue={route.name}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            defaultValue={route.description ?? ""}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="visibility" className="block text-sm font-medium text-gray-700">
            {t("routes.visibility.label")}
          </label>
          <select
            id="visibility"
            name="visibility"
            defaultValue={route.visibility}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="private">{t("routes.visibility.private")}</option>
            <option value="unlisted">{t("routes.visibility.unlisted")}</option>
            <option value="public">{t("routes.visibility.public")}</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {route.visibility === "private" && t("routes.visibility.privateHelp")}
            {route.visibility === "unlisted" && t("routes.visibility.unlistedHelp")}
            {route.visibility === "public" && t("routes.visibility.publicHelp")}
          </p>
        </div>

        <div>
          <label htmlFor="gpx" className="block text-sm font-medium text-gray-700">
            Update GPX (optional — creates new version)
          </label>
          <input
            id="gpx"
            name="gpx"
            type="file"
            accept=".gpx,application/gpx+xml"
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Save Changes
          </button>
          <a
            href={`/routes/${route.id}`}
            className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
