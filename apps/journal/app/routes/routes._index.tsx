import { data, redirect } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/routes._index";
import { getSessionUser } from "~/lib/auth.server";
import { listRoutes } from "~/lib/routes.server";
import { ClientDate } from "~/components/ClientDate";
import { ClientMap } from "~/components/ClientMap";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const userRoutes = await listRoutes(user.id);
  return data({
    routes: userRoutes.map((r) => ({
      id: r.id,
      name: r.name,
      distance: r.distance,
      elevationGain: r.elevationGain,
      updatedAt: r.updatedAt.toISOString(),
      geojson: r.geojson ?? null,
    })),
  });
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "My Routes — trails.cool" }];
}

export default function RoutesListPage({ loaderData }: Route.ComponentProps) {
  const { routes } = loaderData;
  const { t } = useTranslation("journal");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("routes.myRoutes")}</h1>
        <a
          href="/routes/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          {t("routes.new")}
        </a>
      </div>

      {routes.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">
          {t("routes.noRoutesYet")}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {routes.map((route) => (
            <li key={route.id}>
              <a
                href={`/routes/${route.id}`}
                className="block rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
              >
                <div className="flex gap-4">
                  <div className="w-48 shrink-0">
                    {route.geojson ? (
                      <ClientMap geojson={route.geojson} />
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                        {t("routes.noMapPreview")}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <h2 className="text-lg font-medium text-gray-900">{route.name}</h2>
                      <div className="mt-1 flex gap-4 text-sm text-gray-500">
                        {route.distance != null && (
                          <span>{(route.distance / 1000).toFixed(1)} km</span>
                        )}
                        {route.elevationGain != null && (
                          <span>↑ {route.elevationGain} m</span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-400">
                      <ClientDate iso={route.updatedAt} />
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
