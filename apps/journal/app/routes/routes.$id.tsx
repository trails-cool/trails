import { data, redirect } from "react-router";
import type { Route } from "./+types/routes.$id";
import { getSessionUser } from "~/lib/auth.server";
import { getRouteWithVersions, deleteRoute, updateRoute } from "~/lib/routes.server";
import { createRouteToken } from "~/lib/jwt.server";


export async function loader({ params, request }: Route.LoaderArgs) {
  const route = await getRouteWithVersions(params.id);
  if (!route) throw data({ error: "Route not found" }, { status: 404 });

  const user = await getSessionUser(request);
  const isOwner = user?.id === route.ownerId;

  return data({
    route: {
      id: route.id,
      name: route.name,
      description: route.description,
      distance: route.distance,
      elevationGain: route.elevationGain,
      elevationLoss: route.elevationLoss,
      routingProfile: route.routingProfile,
      hasGpx: !!route.gpx,
      createdAt: route.createdAt.toISOString(),
      updatedAt: route.updatedAt.toISOString(),
    },
    versions: route.versions.map((v) => ({
      version: v.version,
      changeDescription: v.changeDescription,
      createdAt: v.createdAt.toISOString(),
    })),
    isOwner,
  });
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    await deleteRoute(params.id, user.id);
    return redirect("/routes");
  }

  if (intent === "update") {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const gpxFile = formData.get("gpx") as File | null;

    const input: Record<string, unknown> = {};
    if (name) input.name = name;
    if (description !== null) input.description = description;
    if (gpxFile && gpxFile.size > 0) {
      input.gpx = await gpxFile.text();
    }

    await updateRoute(params.id, user.id, input as { name?: string; description?: string; gpx?: string });
    return redirect(`/routes/${params.id}`);
  }

  if (intent === "export-gpx") {
    const route = await getRouteWithVersions(params.id);
    if (!route?.gpx) return data({ error: "No GPX data" }, { status: 400 });

    return new Response(route.gpx, {
      headers: {
        "Content-Type": "application/gpx+xml",
        "Content-Disposition": `attachment; filename="${route.name.replace(/[^a-z0-9]/gi, "_")}.gpx"`,
      },
    });
  }

  if (intent === "edit-in-planner") {
    const route = await getRouteWithVersions(params.id);
    if (!route) return data({ error: "Route not found" }, { status: 404 });

    const token = await createRouteToken(params.id);
    const origin = process.env.ORIGIN ?? "http://localhost:3000";
    const callbackUrl = `${origin}/api/routes/${params.id}/callback`;
    const plannerUrl = process.env.PLANNER_URL ?? "http://localhost:3001";

    const plannerParams = new URLSearchParams({
      callback: callbackUrl,
      token,
      returnUrl: `${origin}/routes/${params.id}`,
    });

    // If route has GPX, include it
    if (route.gpx) {
      plannerParams.set("gpx", encodeURIComponent(route.gpx));
    }

    return redirect(`${plannerUrl}/new?${plannerParams}`);
  }

  return data({ error: "Unknown action" }, { status: 400 });
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  const name = (loaderData as { route: { name: string } })?.route?.name ?? "Route";
  return [{ title: `${name} — trails.cool` }];
}

export default function RouteDetailPage({ loaderData }: Route.ComponentProps) {
  const { route, versions, isOwner } = loaderData;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{route.name}</h1>
          {route.description && (
            <p className="mt-2 text-gray-600">{route.description}</p>
          )}
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <form method="post">
              <input type="hidden" name="intent" value="edit-in-planner" />
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                Edit in Planner
              </button>
            </form>
            <a
              href={`/routes/${route.id}/edit`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Edit
            </a>
            <form method="post">
              <input type="hidden" name="intent" value="export-gpx" />
              <button
                type="submit"
                disabled={!route.hasGpx}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Export GPX
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {route.distance != null && (
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-2xl font-bold text-gray-900">
              {(route.distance / 1000).toFixed(1)} km
            </p>
            <p className="text-sm text-gray-500">Distance</p>
          </div>
        )}
        {route.elevationGain != null && (
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-2xl font-bold text-gray-900">↑ {route.elevationGain} m</p>
            <p className="text-sm text-gray-500">Ascent</p>
          </div>
        )}
        {route.elevationLoss != null && (
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-2xl font-bold text-gray-900">↓ {route.elevationLoss} m</p>
            <p className="text-sm text-gray-500">Descent</p>
          </div>
        )}
      </div>

      {versions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Version History</h2>
          <ul className="mt-3 divide-y divide-gray-200">
            {versions.map((v) => (
              <li key={v.version} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">v{v.version}</span>
                  <span className="text-sm text-gray-500">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {v.changeDescription && (
                  <p className="text-sm text-gray-500">{v.changeDescription}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOwner && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <form method="post" onSubmit={(e) => {
            if (!confirm("Are you sure you want to delete this route?")) {
              e.preventDefault();
            }
          }}>
            <input type="hidden" name="intent" value="delete" />
            <button
              type="submit"
              className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100"
            >
              Delete Route
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
