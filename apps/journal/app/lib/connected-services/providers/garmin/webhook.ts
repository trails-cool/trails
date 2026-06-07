// Garmin WebhookReceiver capability adapter (spec: garmin-import,
// "Push-notification activity import" + "Deregistration handling").
//
// Garmin POSTs notifications to /api/sync/webhook/garmin in batches:
// - `activityFiles`: ping-style entries with a callbackURL to a FIT/GPX
//   file (the main import path)
// - `activities` / `activityDetails`: summary entries (stats; used for
//   FIT-less activities)
// - `deregistrations`: the user revoked access on Garmin's side
//
// The webhook must answer fast (Garmin retries and throttles slow
// consumers), so `handle` only validates + enqueues; the download and
// FIT→GPX conversion happen in the `garmin-import-activity` pg-boss job
// (same lesson as federation's inbox: never do slow work in an inbound
// hook). Deregistrations are the exception — a single UPDATE is cheap
// and must not be lost to a queue hiccup.
//
// Notification shapes are under-documented and drift between Garmin API
// versions, so parsing is tolerant: unknown keys are ignored, malformed
// entries are skipped, and nothing here ever throws on bad input.

import { logger } from "../../../logger.server.ts";
import { enqueueOptional } from "../../../boss.server.ts";
import { getServiceByProviderUser, markRevoked } from "../../manager.ts";
import type { WebhookEvent, WebhookReceiver } from "../../registry.ts";
import { isAllowedGarminCallback } from "./import.server.ts";

interface GarminNotificationEntry {
  userId?: string;
  summaryId?: string | number;
  activityId?: string | number;
  activityName?: string;
  activityType?: string;
  callbackURL?: string;
  fileType?: string;
  startTimeInSeconds?: number;
  durationInSeconds?: number;
  distanceInMeters?: number;
}

interface GarminWebhookBody {
  activityFiles?: GarminNotificationEntry[];
  activities?: GarminNotificationEntry[];
  activityDetails?: GarminNotificationEntry[];
  deregistrations?: { userId?: string }[];
}

const EVENT_FILE = "garmin:activity-file";
const EVENT_SUMMARY = "garmin:activity-summary";
const EVENT_DEREGISTRATION = "garmin:deregistration";

function externalId(entry: GarminNotificationEntry): string {
  const id = entry.activityId ?? entry.summaryId;
  return id == null ? "" : String(id);
}

function entryToEvent(
  entry: GarminNotificationEntry,
  eventType: string,
): WebhookEvent | null {
  if (!entry.userId || !externalId(entry)) return null;
  return {
    eventType,
    providerUserId: entry.userId,
    workoutId: externalId(entry),
    fileUrl: entry.callbackURL,
    name: entry.activityName,
    startedAt:
      entry.startTimeInSeconds != null
        ? new Date(entry.startTimeInSeconds * 1000).toISOString()
        : undefined,
    duration: entry.durationInSeconds ?? null,
    distance: entry.distanceInMeters ?? null,
    fileType: entry.fileType,
  };
}

export const garminWebhook: WebhookReceiver = {
  parseWebhook(body: unknown): WebhookEvent[] {
    if (typeof body !== "object" || body === null) return [];
    const payload = body as GarminWebhookBody;
    const events: WebhookEvent[] = [];

    for (const entry of payload.activityFiles ?? []) {
      const event = entryToEvent(entry, EVENT_FILE);
      if (event) events.push(event);
    }
    // Summaries cover FIT-less activities (stats-only import). A FIT
    // notification for the same activityId wins via sync_imports dedupe
    // ordering being first-come — both paths import once.
    for (const entry of [...(payload.activities ?? []), ...(payload.activityDetails ?? [])]) {
      const event = entryToEvent(entry, EVENT_SUMMARY);
      if (event) events.push(event);
    }
    for (const dereg of payload.deregistrations ?? []) {
      if (dereg.userId) {
        events.push({
          eventType: EVENT_DEREGISTRATION,
          providerUserId: dereg.userId,
          workoutId: "",
        });
      }
    }
    return events;
  },

  async handle(event: WebhookEvent): Promise<void> {
    // Unknown users: silent 200 — never reveal user existence.
    const service = await getServiceByProviderUser("garmin", event.providerUserId);
    if (!service) return;

    if (event.eventType === EVENT_DEREGISTRATION) {
      // Spec: provider-side revocation keeps the row (audit) but stops
      // every subsequent Garmin call for this user.
      await markRevoked(service.id);
      logger.info({ serviceId: service.id }, "garmin: deregistration — connection revoked");
      return;
    }

    // SSRF guard: a callback URL that doesn't point at Garmin's API is
    // dropped here, before it can ever be fetched (design.md, Risks).
    if (event.fileUrl && !isAllowedGarminCallback(event.fileUrl)) {
      logger.warn(
        { host: safeHost(event.fileUrl) },
        "garmin: notification callback URL not on the Garmin allowlist — dropped",
      );
      return;
    }

    await enqueueOptional(
      "garmin-import-activity",
      {
        serviceId: service.id,
        userId: service.userId,
        externalId: event.workoutId,
        callbackUrl: event.fileUrl ?? null,
        fileType: event.fileType ?? (event.eventType === EVENT_FILE ? "FIT" : null),
        name: event.name ?? null,
        startedAt: event.startedAt ?? null,
        duration: event.duration ?? null,
        distance: event.distance ?? null,
      },
      { reason: "garmin webhook notification" },
    );
  },
};

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "<unparseable>";
  }
}
