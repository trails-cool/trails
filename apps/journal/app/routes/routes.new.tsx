
import { data, redirect } from "react-router";
import type { Route } from "./+types/routes.new";
import { getSessionUser } from "~/lib/auth.server";
import { createRoute } from "~/lib/routes.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");
  return data({});
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const gpxFile = formData.get("gpx") as File | null;

  if (!name) return data({ error: "Name is required" }, { status: 400 });

  let gpx: string | undefined;
  if (gpxFile && gpxFile.size > 0) {
    gpx = await gpxFile.text();
  }

  const routeId = await createRoute(user.id, { name, description, gpx });
  return redirect(`/routes/${routeId}`);
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "New Route — trails.cool" }];
}

export default function NewRoutePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">New Route</h1>

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
            placeholder="Sunday morning ride"
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
          <label htmlFor="gpx" className="block text-sm font-medium text-gray-700">
            GPX file (optional)
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
            Create Route
          </button>
          <a
            href="/routes"
            className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
