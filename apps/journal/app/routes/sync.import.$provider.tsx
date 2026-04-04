import { data, redirect } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/sync.import.$provider";
import { getSessionUser } from "~/lib/auth.server";
import { getProvider } from "~/lib/sync/registry";
import { getConnection, updateTokens } from "~/lib/sync/connections.server";
import { getImportedIds, recordImport } from "~/lib/sync/imports.server";
import { createActivity } from "~/lib/activities.server";
import { ClientDate } from "~/components/ClientDate";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const provider = getProvider(params.provider);
  if (!provider) throw data({ error: "Unknown provider" }, { status: 404 });

  const connection = await getConnection(user.id, provider.id);
  if (!connection) return redirect("/settings");

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");

  // Refresh token if needed
  let tokens = {
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiresAt: connection.expiresAt,
  };
  if (new Date() >= tokens.expiresAt) {
    tokens = await provider.refreshToken(tokens.refreshToken);
    await updateTokens(connection.id, tokens);
  }

  const workoutList = await provider.listWorkouts(tokens, page);
  const importedIds = await getImportedIds(
    user.id,
    provider.id,
    workoutList.workouts.map((w) => w.id),
  );

  return data({
    provider: { id: provider.id, name: provider.name },
    workouts: workoutList.workouts.map((w) => ({
      ...w,
      imported: importedIds.has(w.id),
    })),
    page: workoutList.page,
    totalPages: Math.ceil(workoutList.total / workoutList.perPage),
  });
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const provider = getProvider(params.provider);
  if (!provider) throw data({ error: "Unknown provider" }, { status: 404 });

  const connection = await getConnection(user.id, provider.id);
  if (!connection) return redirect("/settings");

  const formData = await request.formData();
  const workoutId = formData.get("workoutId") as string;
  const workoutName = formData.get("workoutName") as string;
  const fileUrl = formData.get("fileUrl") as string;

  // Refresh token if needed
  let tokens = {
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiresAt: connection.expiresAt,
  };
  if (new Date() >= tokens.expiresAt) {
    tokens = await provider.refreshToken(tokens.refreshToken);
    await updateTokens(connection.id, tokens);
  }

  const workout = {
    id: workoutId,
    name: workoutName,
    type: "",
    startedAt: "",
    duration: null,
    distance: null,
    fileUrl: fileUrl || undefined,
  };

  const fileBuffer = await provider.downloadFile(tokens, workout);
  const gpx = await provider.convertToGpx(fileBuffer);

  const activityId = await createActivity(user.id, {
    name: workoutName || `${provider.name} workout`,
    gpx: gpx ?? undefined,
  });

  await recordImport(user.id, provider.id, workoutId, activityId);

  return data({ imported: workoutId });
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  const name = (loaderData as { provider: { name: string } })?.provider?.name ?? "Import";
  return [{ title: `Import from ${name} — trails.cool` }];
}

export default function SyncImportPage({ loaderData, actionData }: Route.ComponentProps) {
  const { provider, workouts, page, totalPages } = loaderData;
  const { t } = useTranslation("journal");
  const justImported = (actionData as { imported?: string })?.imported;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">
        {t("sync.importFrom", { provider: provider.name })}
      </h1>

      {workouts.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">{t("sync.noWorkouts")}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {workouts.map((w) => (
            <li
              key={w.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
            >
              <div>
                <p className="font-medium text-gray-900">{w.name}</p>
                <div className="mt-1 flex gap-3 text-sm text-gray-500">
                  {w.startedAt && <ClientDate iso={w.startedAt} />}
                  {w.distance != null && <span>{(w.distance / 1000).toFixed(1)} km</span>}
                  {w.duration != null && <span>{Math.round(w.duration / 60)} min</span>}
                </div>
              </div>
              {w.imported || justImported === w.id ? (
                <span className="text-sm text-green-600">{t("sync.imported")}</span>
              ) : (
                <form method="post">
                  <input type="hidden" name="workoutId" value={w.id} />
                  <input type="hidden" name="workoutName" value={w.name} />
                  <input type="hidden" name="fileUrl" value={w.fileUrl ?? ""} />
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                  >
                    {t("sync.import")}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {page > 1 && (
            <a
              href={`/sync/import/${provider.id}?page=${page - 1}`}
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
            >
              {t("sync.previous")}
            </a>
          )}
          <span className="px-3 py-1 text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`/sync/import/${provider.id}?page=${page + 1}`}
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
            >
              {t("sync.next")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
