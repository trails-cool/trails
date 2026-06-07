import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/api.sync.webhook.$provider";
import { getManifest } from "~/lib/connected-services";

// Generic webhook envelope. Provider-specific shape validation happens in
// each provider's `parseWebhook`; here we only enforce that the body is a
// JSON object so downstream code never crashes on a malformed payload.
const webhookEnvelope = z.object({ webhook_token: z.string().optional() }).passthrough();

export async function action({ params, request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const manifest = getManifest(params.provider);
  if (!manifest || !manifest.webhookReceiver) {
    // Don't reveal provider existence — return 200 silently.
    return data({ ok: true });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return data({ ok: true });
  }
  const envelope = webhookEnvelope.safeParse(raw);
  if (!envelope.success) {
    return data({ ok: true });
  }
  const body = envelope.data;

  // Verify webhook token (provider-specific shared secret).
  const expectedToken = process.env[`${params.provider.toUpperCase()}_WEBHOOK_TOKEN`];
  if (expectedToken && body.webhook_token !== expectedToken) {
    return data({ ok: true });
  }

  const events = manifest.webhookReceiver.parseWebhook(body);
  for (const event of events) {
    try {
      await manifest.webhookReceiver.handle(event);
    } catch (e) {
      console.error(`Webhook import failed for ${manifest.id}/${event.workoutId}:`, e);
    }
  }

  return data({ ok: true });
}
