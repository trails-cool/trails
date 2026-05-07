import { data } from "react-router";
import type { Route } from "./+types/api.sync.webhook.$provider";
import { getManifest } from "~/lib/connected-services";

export async function action({ params, request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const manifest = getManifest(params.provider);
  if (!manifest || !manifest.webhookReceiver) {
    // Don't reveal provider existence — return 200 silently.
    return data({ ok: true });
  }

  const body = await request.json();

  // Verify webhook token (provider-specific shared secret).
  const expectedToken = process.env[`${params.provider.toUpperCase()}_WEBHOOK_TOKEN`];
  if (
    expectedToken &&
    (body as { webhook_token?: string }).webhook_token !== expectedToken
  ) {
    return data({ ok: true });
  }

  const event = manifest.webhookReceiver.parseWebhook(body);
  if (!event) return data({ ok: true });

  try {
    await manifest.webhookReceiver.handle(event);
  } catch (e) {
    console.error(`Webhook import failed for ${manifest.id}/${event.workoutId}:`, e);
  }

  return data({ ok: true });
}
