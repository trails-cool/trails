import { useCallback, useEffect, useRef, useState } from "react";
import { data, redirect, useFetcher } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/sync.import.$provider";
import { getSessionUser } from "~/lib/auth.server";
import {
  getManifest,
  getService,
  capabilityContextFor,
} from "~/lib/connected-services";
import { getImportedIds, recordImport } from "~/lib/sync/imports.server";
import { createActivity } from "~/lib/activities.server";
import { ClientDate } from "~/components/ClientDate";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const manifest = getManifest(params.provider);
  if (!manifest || !manifest.importer) {
    throw data({ error: "Unknown provider" }, { status: 404 });
  }

  const service = await getService(user.id, manifest.id);
  if (!service) return redirect("/settings");

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");

  const ctx = capabilityContextFor(service.id);
  const workoutList = await manifest.importer.listImportable(ctx, page);

  const importedIds = await getImportedIds(
    user.id,
    manifest.id,
    workoutList.workouts.map((w) => w.id),
  );

  return data({
    provider: { id: manifest.id, name: manifest.displayName },
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

  const manifest = getManifest(params.provider);
  if (!manifest || !manifest.importer) {
    throw data({ error: "Unknown provider" }, { status: 404 });
  }

  const service = await getService(user.id, manifest.id);
  if (!service) return redirect("/settings");

  const formData = await request.formData();
  const workoutId = formData.get("workoutId") as string;
  const workoutName = formData.get("workoutName") as string;
  const fileUrl = formData.get("fileUrl") as string;
  const startedAt = formData.get("startedAt") as string;
  const distance = formData.get("distance") as string;
  const duration = formData.get("duration") as string;

  // Inline import here (not via Importer.importOne) so we can pass through
  // the form-supplied metadata (started_at, distance, duration) the
  // capability seam doesn't carry. The seam-shape importer is reserved for
  // automatic / webhook-driven imports.
  let gpx: string | null = null;
  if (fileUrl) {
    const ctx = capabilityContextFor(service.id);
    // Wahoo CDN URLs are pre-signed; we still go through withFreshCredentials
    // so the manager handles refresh of any near-expired token.
    const buffer = await ctx.withFreshCredentials(async () => {
      const resp = await fetch(fileUrl);
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      return Buffer.from(await resp.arrayBuffer());
    });
    // Lazy-load to avoid bundling fit-file-parser into all routes.
    const { default: FitParser } = await import("fit-file-parser");
    const { generateGpx } = await import("@trails-cool/gpx");
    const parsed = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const parser = new FitParser({ force: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parser.parse(buffer as any, (err: unknown, d: any) => (err ? reject(err) : resolve(d ?? {})));
    });
    const records = (parsed.records ?? []) as Array<{
      position_lat?: number;
      position_long?: number;
      altitude?: number;
      timestamp?: string | Date;
    }>;
    const trackPoints = records
      .filter((r) => r.position_lat != null && r.position_long != null)
      .map((r) => ({
        lat: r.position_lat!,
        lon: r.position_long!,
        ele: r.altitude,
        time: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
      }));
    if (trackPoints.length >= 2) {
      gpx = generateGpx({ name: workoutName, tracks: [trackPoints] });
    }
  }

  const activityId = await createActivity(user.id, {
    name: workoutName || `${manifest.displayName} workout`,
    gpx: gpx ?? undefined,
    distance: distance ? parseFloat(distance) : null,
    duration: duration ? parseInt(duration) : null,
    startedAt: startedAt ? new Date(startedAt) : null,
  });

  await recordImport(user.id, manifest.id, workoutId, activityId);

  return data({ imported: workoutId });
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  const name = (loaderData as { provider: { name: string } })?.provider?.name ?? "Import";
  return [{ title: `Import from ${name} — trails.cool` }];
}

function WorkoutRow({
  workout,
  provider,
  alreadyImported,
}: {
  workout: { id: string; name: string; fileUrl?: string; startedAt: string; distance: number | null; duration: number | null };
  provider: { id: string; name: string };
  alreadyImported: boolean;
}) {
  const { t } = useTranslation("journal");
  const fetcher = useFetcher<{ imported?: string }>();
  const isImporting = fetcher.state !== "idle";
  const isImported = alreadyImported || fetcher.data?.imported === workout.id;

  return (
    <li className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900">{workout.name}</p>
          {!workout.fileUrl && (
            <span
              className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
              title={t("sync.noGpsTooltip", { provider: provider.name })}
            >
              {t("sync.noGps")}
            </span>
          )}
        </div>
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
          <input type="hidden" name="fileUrl" value={workout.fileUrl ?? ""} />
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

function workoutFormData(w: { id: string; name: string; fileUrl?: string; startedAt: string; distance: number | null; duration: number | null }) {
  const fd = new FormData();
  fd.set("workoutId", w.id);
  fd.set("workoutName", w.name);
  fd.set("fileUrl", w.fileUrl ?? "");
  fd.set("startedAt", w.startedAt ?? "");
  fd.set("distance", w.distance != null ? String(w.distance) : "");
  fd.set("duration", w.duration != null ? String(w.duration) : "");
  return fd;
}

export default function SyncImportPage({ loaderData }: Route.ComponentProps) {
  const { provider, workouts, page, totalPages } = loaderData;
  const { t } = useTranslation("journal");

  const importableWorkouts = workouts.filter((w) => !w.imported);
  const [importAllActive, setImportAllActive] = useState(false);
  const [importAllIndex, setImportAllIndex] = useState(0);
  const importAllFetcher = useFetcher<{ imported?: string }>();
  const importAllRef = useRef({ index: 0, workouts: importableWorkouts });

  useEffect(() => {
    importAllRef.current.workouts = importableWorkouts;
  }, [importableWorkouts]);

  useEffect(() => {
    if (!importAllActive) return;
    if (importAllFetcher.state !== "idle") return;

    // Previous import finished — advance to next
    const nextIndex = importAllFetcher.data ? importAllRef.current.index + 1 : importAllRef.current.index;
    importAllRef.current.index = nextIndex;
    setImportAllIndex(nextIndex);

    if (nextIndex >= importAllRef.current.workouts.length) {
      setImportAllActive(false);
      return;
    }

    const w = importAllRef.current.workouts[nextIndex]!;
    importAllFetcher.submit(workoutFormData(w), { method: "post" });
  }, [importAllActive, importAllFetcher.state, importAllFetcher.data]);

  const startImportAll = useCallback(() => {
    if (importableWorkouts.length === 0) return;
    importAllRef.current = { index: 0, workouts: importableWorkouts };
    setImportAllIndex(0);
    setImportAllActive(true);

    importAllFetcher.submit(workoutFormData(importableWorkouts[0]!), { method: "post" });
  }, [importableWorkouts, importAllFetcher]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("sync.importFrom", { provider: provider.name })}
        </h1>
        {importableWorkouts.length > 0 && (
          importAllActive ? (
            <span className="text-sm text-gray-500">
              {t("sync.importingProgress", { current: importAllIndex + 1, total: importAllRef.current.workouts.length })}
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
            <WorkoutRow
              key={w.id}
              workout={w}
              provider={provider}
              alreadyImported={w.imported || importAllFetcher.data?.imported === w.id}
            />
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
