// Wahoo Importer capability adapter. Implements the Importer seam against
// Wahoo's /v1/workouts API.
//
// Credentials always flow through ctx.withFreshCredentials — this module
// never reads the connected_services credentials JSONB directly.

import { fitToGpx } from "../../fit.ts";
import { fetchWithTimeout } from "../../../http.server.ts";
import { importActivity, isAlreadyImported } from "../../../sync/imports.server.ts";
import type {
  CapabilityContext,
  ImportableList,
  ImportResult,
  Importer,
} from "../../registry.ts";
import type { OAuthCredentials } from "../../types.ts";

const WAHOO_API = "https://api.wahooligan.com";

interface WahooWorkout {
  id: number;
  name: string;
  workout_type: string;
  starts: string;
  fitness_app_id?: number;
  workout_summary?: {
    duration_active_accum?: number;
    distance_accum?: number;
    file?: { url?: string };
  };
}

async function fetchWahooWorkoutPage(
  creds: OAuthCredentials,
  page: number,
): Promise<{
  workouts: WahooWorkout[];
  total: number;
  page: number;
  per_page: number;
}> {
  const params = new URLSearchParams({ page: String(page), per_page: "30" });
  const resp = await fetchWithTimeout(`${WAHOO_API}/v1/workouts?${params}`, {
    headers: { Authorization: `Bearer ${creds.access_token}` },
  });
  if (!resp.ok) throw new Error(`Wahoo list workouts failed: ${resp.status}`);
  return resp.json() as Promise<{
    workouts: WahooWorkout[];
    total: number;
    page: number;
    per_page: number;
  }>;
}

function toImportable(w: WahooWorkout) {
  return {
    id: String(w.id),
    name: w.name || `Workout ${w.id}`,
    type: w.workout_type ?? "unknown",
    startedAt: w.starts,
    duration: w.workout_summary?.duration_active_accum
      ? Math.round(w.workout_summary.duration_active_accum)
      : null,
    distance: w.workout_summary?.distance_accum
      ? Math.round(w.workout_summary.distance_accum)
      : null,
    fileUrl: w.workout_summary?.file?.url,
  };
}

async function downloadFit(fileUrl: string): Promise<Buffer> {
  // Wahoo CDN URLs are pre-signed; no auth header needed (and adding one
  // breaks them).
  const resp = await fetchWithTimeout(fileUrl);
  if (!resp.ok) throw new Error(`Wahoo file download failed: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

export const wahooImporter: Importer = {
  async listImportable(
    ctx: CapabilityContext,
    page: number,
  ): Promise<ImportableList> {
    const data = await ctx.withFreshCredentials((creds) =>
      fetchWahooWorkoutPage(creds as OAuthCredentials, page),
    );

    // Wahoo does not share workout data from third-party apps
    // (fitness_app_id >= 1000).
    const wahooOnly = data.workouts.filter(
      (w) => !w.fitness_app_id || w.fitness_app_id < 1000,
    );

    return {
      workouts: wahooOnly.map(toImportable),
      total: data.total,
      page: data.page,
      perPage: data.per_page,
    };
  },

  async importOne(
    ctx: CapabilityContext,
    workoutId: string,
  ): Promise<ImportResult> {
    // Look up the workout to get the file URL (Wahoo doesn't expose a
    // direct /v1/workouts/<id> with file; we re-fetch the page).
    // For simplicity we ask Wahoo for the workout directly; if that fails
    // we fall back to scanning page 1.
    const list = await ctx.withFreshCredentials((creds) =>
      fetchWahooWorkoutPage(creds as OAuthCredentials, 1),
    );
    const workout = list.workouts.find((w) => String(w.id) === workoutId);
    if (!workout) throw new Error(`Wahoo workout ${workoutId} not found on page 1`);

    // Resolve the connected service's user id via the capability context.
    // The caller (route handler) supplies userId out-of-band — for now the
    // route handler bridges the gap. We use the manager's getServiceById.
    const { getServiceById } = await import("../../manager.ts");
    const service = await getServiceById(ctx.serviceId);
    if (!service) throw new Error(`Connected service ${ctx.serviceId} not found`);

    const userId = service.userId;
    if (await isAlreadyImported(userId, "wahoo", workoutId)) {
      throw new Error(`Workout ${workoutId} already imported`);
    }

    let gpx: string | null = null;
    if (workout.workout_summary?.file?.url) {
      const buffer = await downloadFit(workout.workout_summary.file.url);
      gpx = await fitToGpx(buffer, workout.name || "Wahoo workout");
    }

    const { activityId } = await importActivity(userId, "wahoo", workoutId, {
      name: workout.name || `Wahoo workout ${workoutId}`,
      gpx: gpx ?? undefined,
    });

    return { activityId, hadGeometry: gpx !== null };
  },
};
