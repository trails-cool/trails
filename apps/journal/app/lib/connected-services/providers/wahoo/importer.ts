// Wahoo Importer capability adapter. Implements the Importer seam against
// Wahoo's /v1/workouts API.
//
// Credentials always flow through ctx.withFreshCredentials — this module
// never reads the connected_services credentials JSONB directly.

import { fitToGpx, type FitConversion } from "../../fit.ts";
import { fetchWithTimeout } from "../../../http.server.ts";
import { importActivity, isAlreadyImported } from "../../../sync/imports.server.ts";
import { getServiceById } from "../../manager.ts";
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
    // Wahoo doesn't expose a direct /v1/workouts/<id> endpoint with file
    // URL, so we paginate /v1/workouts looking for the target. Bound by
    // the total / per_page Wahoo returns on page 1, with a hard ceiling
    // so a misbehaving API can't loop us forever.
    const MAX_PAGES = 100;
    let workout: WahooWorkout | undefined;
    let totalPages = 1;
    for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
      const list = await ctx.withFreshCredentials((creds) =>
        fetchWahooWorkoutPage(creds as OAuthCredentials, page),
      );
      // perPage may not divide total cleanly; ceil so we don't stop one
      // page short.
      if (page === 1 && list.per_page > 0) {
        totalPages = Math.ceil(list.total / list.per_page);
      }
      const found = list.workouts.find((w) => String(w.id) === workoutId);
      if (found) {
        workout = found;
        break;
      }
      if (list.workouts.length === 0) break;
    }
    if (!workout) throw new Error(`Wahoo workout ${workoutId} not found`);

    // Resolve the connected service's user id via the capability context.
    // The caller (route handler) supplies userId out-of-band — for now the
    // route handler bridges the gap. We use the manager's getServiceById.
    const service = await getServiceById(ctx.serviceId);
    if (!service) throw new Error(`Connected service ${ctx.serviceId} not found`);

    const userId = service.userId;
    if (await isAlreadyImported(userId, "wahoo", workoutId)) {
      throw new Error(`Workout ${workoutId} already imported`);
    }

    let gpx: string | null = null;
    let sport: FitConversion["sport"] = null;
    if (workout.workout_summary?.file?.url) {
      const buffer = await downloadFit(workout.workout_summary.file.url);
      ({ gpx, sport } = await fitToGpx(buffer, workout.name || "Wahoo workout"));
    }

    const { activityId } = await importActivity(userId, "wahoo", workoutId, {
      name: workout.name || `Wahoo workout ${workoutId}`,
      gpx: gpx ?? undefined,
      // Wahoo's list API sends no explicit sport type, so the FIT session
      // sport is our best signal (provider-explicit would take precedence).
      sportType: sport ?? undefined,
    });

    return { activityId, hadGeometry: gpx !== null };
  },
};
