// Komoot-specific import page. Mirrors the generic sync.import.$provider page
// but fetches GPX directly from Komoot instead of downloading a FIT file.

import { useCallback, useEffect, useRef, useState } from "react";
import { data, redirect, useFetcher } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/sync.import.komoot";
import { getSessionUser } from "~/lib/auth/session.server";
import { getService, capabilityContextFor } from "~/lib/connected-services";
import { getManifest } from "~/lib/connected-services";
import { getImportedIds, recordImport } from "~/lib/sync/imports.server";
import { createActivity } from "~/lib/activities.server";
import { fetchKomootTourGpx } from "~/lib/komoot.server";
import { decrypt } from "~/lib/crypto.server";
import { ClientDate } from "~/components/ClientDate";

type KomootCreds =
  | { mode: "public"; komootUserId: string }
  | { mode: "authenticated"; email: string; encryptedPassword: string; komootUserId: string };

function getBasicAuthToken(creds: KomootCreds): string | undefined {
  if (creds.mode !== "authenticated") return undefined;
  const password = decrypt(creds.encryptedPassword);
  return Buffer.from(`${creds.email}:${password}`).toString("base64");
}

export function meta() {
  return [{ title: "Import from Komoot — trails.cool" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const manifest = getManifest("komoot");
  if (!manifest?.importer) throw data({ error: "Komoot not configured" }, { status: 500 });

  const service = await getService(user.id, "komoot");
  if (!service) return redirect("/settings/connections/komoot");

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");

  const ctx = capabilityContextFor(service.id);
  const workoutList = await manifest.importer.listImportable(ctx, page);

  const importedIds = await getImportedIds(
    user.id,
    "komoot",
    workoutList.workouts.map((w) => w.id),
  );

  return data({
    workouts: workoutList.workouts.map((w) => ({
      ...w,
      imported: importedIds.has(w.id),
    })),
    page: workoutList.page,
    totalPages: Math.ceil(workoutList.total / workoutList.perPage),
  });
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const service = await getService(user.id, "komoot");
  if (!service) return redirect("/settings/connections/komoot");

  const formData = await request.formData();
  const tourId = formData.get("workoutId") as string;
  const workoutName = formData.get("workoutName") as string;
  const startedAt = formData.get("startedAt") as string;
  const distance = formData.get("distance") as string;
  const duration = formData.get("duration") as string;

  const creds = service.credentials as KomootCreds;
  const basicAuthToken = getBasicAuthToken(creds);

  let gpx: string | undefined;
  try {
    gpx = await fetchKomootTourGpx(tourId, basicAuthToken);
  } catch {
    // No GPX available — import without geometry
  }

  const activityId = await createActivity(user.id, {
    name: workoutName || `Komoot tour ${tourId}`,
    gpx,
    distance: distance ? parseFloat(distance) : null,
    duration: duration ? parseInt(duration) : null,
    startedAt: startedAt ? new Date(startedAt) : null,
  });

  await recordImport(user.id, "komoot", tourId, activityId);

  return data({ imported: tourId });
}

function TourRow({
  workout,
  alreadyImported,
}: {
  workout: { id: string; name: string; startedAt: string; distance: number | null; duration: number | null };
  alreadyImported: boolean;
}) {
  const { t } = useTranslation("journal");
  const fetcher = useFetcher<{ imported?: string }>();
  const isImporting = fetcher.state !== "idle";
  const isImported = alreadyImported || fetcher.data?.imported === workout.id;

  return (
    <li className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
      <div>
        <p className="font-medium text-gray-900">{workout.name}</p>
        <div className="mt-1 flex gap-3 text-sm text-gray-500">
          {workout.startedAt && <ClientDate iso={workout.startedAt} />}
          {workout.distance != null && <span>{(workout.distance / 1000).toFixed(1)} km</span>}
          {workout.duration != null && <span>{Math.round(workout.duration / 60)} min</span>}
        </div>
      </div>
      {isImported ? (
        <span className="text-sm text-green-600">{t("sync.imported")}</span>
      ) : isImporting ? (
        <span className="text-sm text-gray-400">{t("sync.importing")}</span>
      ) : (
        <fetcher.Form method="post">
          <input type="hidden" name="workoutId" value={workout.id} />
          <input type="hidden" name="workoutName" value={workout.name} />
          <input type="hidden" name="startedAt" value={workout.startedAt ?? ""} />
          <input type="hidden" name="distance" value={workout.distance ?? ""} />
          <input type="hidden" name="duration" value={workout.duration ?? ""} />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            {t("sync.import")}
          </button>
        </fetcher.Form>
      )}
    </li>
  );
}

function tourFormData(w: { id: string; name: string; startedAt: string; distance: number | null; duration: number | null }) {
  const fd = new FormData();
  fd.set("workoutId", w.id);
  fd.set("workoutName", w.name);
  fd.set("startedAt", w.startedAt ?? "");
  fd.set("distance", w.distance != null ? String(w.distance) : "");
  fd.set("duration", w.duration != null ? String(w.duration) : "");
  return fd;
}

export default function KomootImportPage({ loaderData }: Route.ComponentProps) {
  const { workouts, page, totalPages } = loaderData;
  const { t } = useTranslation("journal");

  const importableWorkouts = workouts.filter((w) => !w.imported);
  const [importAllActive, setImportAllActive] = useState(false);
  const [importAllIndex, setImportAllIndex] = useState(0);
  const importAllFetcher = useFetcher<{ imported?: string }>();
  const importAllRef = useRef({ index: 0, workouts: importableWorkouts });

  useEffect(() => {
    if (!importAllActive) return;
    if (importAllFetcher.state !== "idle") return;

    const nextIndex = importAllFetcher.data
      ? importAllRef.current.index + 1
      : importAllRef.current.index;
    importAllRef.current.index = nextIndex;
    setImportAllIndex(nextIndex);

    if (nextIndex >= importAllRef.current.workouts.length) {
      setImportAllActive(false);
      return;
    }

    const w = importAllRef.current.workouts[nextIndex]!;
    importAllFetcher.submit(tourFormData(w), { method: "post" });
  }, [importAllActive, importAllFetcher.state, importAllFetcher.data]);

  const startImportAll = useCallback(() => {
    if (importableWorkouts.length === 0) return;
    importAllRef.current = { index: 0, workouts: importableWorkouts };
    setImportAllIndex(0);
    setImportAllActive(true);
    importAllFetcher.submit(tourFormData(importableWorkouts[0]!), { method: "post" });
  }, [importableWorkouts, importAllFetcher]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("sync.importFrom", { provider: "Komoot" })}
        </h1>
        {importableWorkouts.length > 0 && (
          importAllActive ? (
            <span className="text-sm text-gray-500">
              {t("sync.importingProgress", {
                current: importAllIndex + 1,
                total: importAllRef.current.workouts.length,
              })}
            </span>
          ) : (
            <button
              onClick={startImportAll}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t("sync.importAll", { count: importableWorkouts.length })}
            </button>
          )
        )}
      </div>

      {workouts.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">{t("sync.noWorkouts")}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {workouts.map((w) => (
            <TourRow
              key={w.id}
              workout={w}
              alreadyImported={w.imported || importAllFetcher.data?.imported === w.id}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {page > 1 && (
            <a
              href={`/sync/import/komoot?page=${page - 1}`}
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
              href={`/sync/import/komoot?page=${page + 1}`}
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
