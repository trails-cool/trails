// Garmin activity import — the slow half of the webhook pipeline.
// Runs inside the `garmin-import-activity` pg-boss job: download the
// activity file from the notification's callback URL (Authorized via
// the user's token), convert to GPX, create the activity, record the
// dedupe row. Stats-only when there is no file.

import { fitToGpx } from "../../fit.ts";
import { fetchWithTimeout } from "../../../http.server.ts";
import { isAlreadyImported, importActivity } from "../../../sync/imports.server.ts";
import { getServiceById, withFreshCredentials } from "../../manager.ts";
import type { OAuthCredentials } from "../../types.ts";
import { logger } from "../../../logger.server.ts";
import { GARMIN_API } from "./constants.ts";

// SSRF guard: notification callback URLs are attacker-controllable
// input until proven otherwise — only Garmin's API host is fetchable.
const ALLOWED_CALLBACK_HOSTS = new Set([new URL(GARMIN_API).host]);

export function isAllowedGarminCallback(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_CALLBACK_HOSTS.has(parsed.host);
  } catch {
    return false;
  }
}

export interface GarminImportData {
  serviceId: string;
  userId: string;
  externalId: string;
  callbackUrl: string | null;
  fileType: string | null;
  name: string | null;
  startedAt: string | null;
  duration: number | null;
  distance: number | null;
}

export async function runGarminActivityImport(data: GarminImportData): Promise<void> {
  // Connection may have been revoked/relinked between enqueue and run.
  const service = await getServiceById(data.serviceId);
  if (!service || service.status !== "active") {
    logger.info({ serviceId: data.serviceId }, "garmin import: connection not active — skipped");
    return;
  }

  if (await isAlreadyImported(data.userId, "garmin", data.externalId)) return;

  let gpx: string | undefined;
  if (data.callbackUrl && isAllowedGarminCallback(data.callbackUrl)) {
    const buffer = await withFreshCredentials(service.id, async (credentials) => {
      const creds = credentials as OAuthCredentials;
      const resp = await fetchWithTimeout(data.callbackUrl!, {
        headers: { Authorization: `Bearer ${creds.access_token}` },
      });
      if (!resp.ok) {
        throw new Error(`Garmin file download failed: ${resp.status}`);
      }
      return Buffer.from(await resp.arrayBuffer());
    });
    if (data.fileType === "GPX") {
      // Garmin can serve GPX directly; createActivity validates it.
      gpx = buffer.toString("utf8");
    } else {
      // FIT (default) — shared provider-agnostic converter.
      gpx = (await fitToGpx(buffer, data.name ?? "Garmin activity")) ?? undefined;
    }
  }

  await importActivity(data.userId, "garmin", data.externalId, {
    name: data.name ?? "Garmin activity",
    gpx,
    distance: data.distance,
    duration: data.duration,
    startedAt: data.startedAt ? new Date(data.startedAt) : null,
  });
  logger.info(
    { externalId: data.externalId, hadFile: !!gpx },
    "garmin import: activity imported",
  );
}
