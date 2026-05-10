// Wahoo WebhookReceiver capability adapter.
//
// Wahoo posts `workout_summary` events to /api/sync/webhook/wahoo when a
// workout completes. We route the event to the right local user via
// provider_user_id, deduplicate via sync_imports, then download + convert
// the FIT file (if present) and create an activity.

import { fitToGpx } from "../../fit.ts";
import { isAlreadyImported, importActivity } from "../../../sync/imports.server.ts";
import { getServiceByProviderUser, withFreshCredentials } from "../../manager.ts";
import type { OAuthCredentials } from "../../types.ts";
import type { WebhookEvent, WebhookReceiver } from "../../registry.ts";

interface WahooWebhookBody {
  event_type?: string;
  user?: { id?: number };
  workout_summary?: {
    id?: number;
    workout?: { id?: number };
    file?: { url?: string };
  };
}


export const wahooWebhook: WebhookReceiver = {
  parseWebhook(body: unknown): WebhookEvent | null {
    const payload = body as WahooWebhookBody;
    if (payload.event_type !== "workout_summary" || !payload.user?.id) return null;

    return {
      eventType: payload.event_type,
      providerUserId: String(payload.user.id),
      workoutId: String(
        payload.workout_summary?.workout?.id ?? payload.workout_summary?.id ?? "",
      ),
      fileUrl: payload.workout_summary?.file?.url,
    };
  },

  async handle(event: WebhookEvent): Promise<void> {
    // Match incoming webhooks to local users via provider_user_id.
    // Unknown users return silently — no leak.
    const service = await getServiceByProviderUser("wahoo", event.providerUserId);
    if (!service) return;

    if (await isAlreadyImported(service.userId, "wahoo", event.workoutId)) return;

    let gpx: string | null = null;
    if (event.fileUrl) {
      // Wahoo CDN URLs are pre-signed; no auth header needed. We still go
      // through withFreshCredentials so the manager has a chance to refresh
      // a near-expired credential before any subsequent Wahoo call this
      // handler might make.
      const buffer = await withFreshCredentials(service.id, async (_creds) => {
        void (_creds as unknown as OAuthCredentials);
        const resp = await fetch(event.fileUrl!);
        if (!resp.ok) throw new Error(`Wahoo file download failed: ${resp.status}`);
        return Buffer.from(await resp.arrayBuffer());
      });
      gpx = await fitToGpx(buffer, "Wahoo workout");
    }

    await importActivity(service.userId, "wahoo", event.workoutId, {
      name: "Wahoo workout",
      gpx: gpx ?? undefined,
    });
  },
};
