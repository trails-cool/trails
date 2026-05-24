// Server-only loader/action for /sync/import/:provider. See `home.server.ts`.

import { data, redirect } from "react-router";
import { requireSessionUser } from "~/lib/auth/session.server";
import {
  getManifest,
  getService,
  capabilityContextFor,
} from "~/lib/connected-services";
import { getImportedIds, recordImport } from "~/lib/sync/imports.server";
import { createActivity } from "~/lib/activities.server";

export async function loadSyncImportProvider(request: Request, provider: string | undefined) {
  const user = await requireSessionUser(request);

  const manifest = getManifest(provider ?? "");
  if (!manifest || !manifest.importer) {
    throw data({ error: "Unknown provider" }, { status: 404 });
  }

  const service = await getService(user.id, manifest.id);
  if (!service) throw redirect("/settings");

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");

  const ctx = capabilityContextFor(service.id);
  const workoutList = await manifest.importer.listImportable(ctx, page);

  const importedIds = await getImportedIds(
    user.id,
    manifest.id,
    workoutList.workouts.map((w) => w.id),
  );

  return {
    provider: { id: manifest.id, name: manifest.displayName },
    workouts: workoutList.workouts.map((w) => ({
      ...w,
      imported: importedIds.has(w.id),
    })),
    page: workoutList.page,
    totalPages: Math.ceil(workoutList.total / workoutList.perPage),
  };
}

export async function syncImportProviderAction(request: Request, provider: string | undefined) {
  const user = await requireSessionUser(request);

  const manifest = getManifest(provider ?? "");
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

  return { imported: workoutId };
}
