import { data } from "react-router";
import type { Route } from "./+types/api.sync.webhook.$provider";
import { getProvider } from "~/lib/sync/registry";
import { getConnectionByProviderUser, updateTokens } from "~/lib/sync/connections.server";
import { isAlreadyImported, recordImport } from "~/lib/sync/imports.server";
import { createActivity } from "~/lib/activities.server";

export async function action({ params, request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const provider = getProvider(params.provider);
  if (!provider) return data({ ok: true }); // Don't reveal provider existence

  const body = await request.json();

  // Verify webhook token
  const expectedToken = process.env[`${params.provider.toUpperCase()}_WEBHOOK_TOKEN`];
  if (expectedToken && (body as { webhook_token?: string }).webhook_token !== expectedToken) {
    return data({ ok: true }); // Invalid token — ignore silently
  }

  const event = provider.parseWebhook(body);
  if (!event) return data({ ok: true }); // Unrecognized event — ignore silently

  // Look up user by provider user ID
  const connection = await getConnectionByProviderUser(provider.id, event.providerUserId);
  if (!connection) return data({ ok: true }); // Unknown user — ignore

  // Check duplicate
  const alreadyImported = await isAlreadyImported(connection.userId, provider.id, event.workoutId);
  if (alreadyImported) return data({ ok: true });

  try {
    // Refresh token if expired
    let tokens = {
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      expiresAt: connection.expiresAt,
    };
    if (new Date() >= tokens.expiresAt) {
      tokens = await provider.refreshToken(tokens.refreshToken);
      await updateTokens(connection.id, tokens);
    }

    // Download and convert
    const workout = { id: event.workoutId, name: "", type: "", startedAt: "", duration: null, distance: null, fileUrl: event.fileUrl };
    const fileBuffer = await provider.downloadFile(tokens, workout);
    const gpx = await provider.convertToGpx(fileBuffer);

    // Create activity
    const activityId = await createActivity(connection.userId, {
      name: `${provider.name} workout`,
      gpx: gpx ?? undefined,
    });

    await recordImport(connection.userId, provider.id, event.workoutId, activityId);
  } catch (e) {
    console.error(`Webhook import failed for ${provider.id}/${event.workoutId}:`, e);
  }

  // Always return 200 to acknowledge the webhook
  return data({ ok: true });
}
