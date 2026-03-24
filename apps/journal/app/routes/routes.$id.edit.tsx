import { data, redirect } from "react-router";
import type { Route } from "./+types/routes.$id.edit";
import { getSessionUser } from "~/lib/auth.server";
import { getRoute, updateRoute } from "~/lib/routes.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const route = await getRoute(params.id);
  if (!route) throw data({ error: "Route not found" }, { status: 404 });
  if (route.ownerId !== user.id) throw data({ error: "Not authorized" }, { status: 403 });

  return data({
    route: { id: route.id, name: route.name, description: route.description },
  });
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const gpxFile = formData.get("gpx") as File | null;

  const input: { name?: string; description?: string; gpx?: string } = {};
  if (name) input.name = name;
  if (description !== null) input.description = description;
  if (gpxFile && gpxFile.size > 0) {
    input.gpx = await gpxFile.text();
  }

  await updateRoute(params.id, user.id, input);
  return redirect(`/routes/${params.id}`);
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Edit Route — trails.cool" }];
}

export default function EditRoutePage({ loaderData }: Route.ComponentProps) {
  const { route } = loaderData;

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
