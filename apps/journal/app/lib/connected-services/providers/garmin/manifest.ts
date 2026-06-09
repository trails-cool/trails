// Garmin provider manifest (spec: garmin-import). OAuth2 + PKCE on the
// shared oauth credential adapter — PKCE is a handshake detail (see
// design.md), the stored blob is plain OAuthCredentials.
//
// Garmin is push-first: there is no list-activities endpoint, so this
// manifest declares no `importer`. Ingestion happens via the webhook
// receiver (ping/push notifications) and history via backfill requests
// (see backfill.ts + the /sync/import/garmin page).
//
// Endpoint references: Garmin Connect Developer Program, Activity API.
// Exact notification shapes are normalized tolerantly in webhook.ts —
// Garmin's docs shift between API versions (design.md, Risks).

import { oauthCredentialAdapter } from "../../credential-adapters/oauth.ts";
import type { ProviderManifest } from "../../registry.ts";
import type { OAuthCredentials, ProviderOAuthConfig } from "../../types.ts";
import { garminWebhook } from "./webhook.ts";
import { GARMIN_API, GARMIN_AUTHORIZE, GARMIN_TOKEN } from "./constants.ts";

function clientId(): string {
  return process.env.GARMIN_CLIENT_ID ?? "";
}
function clientSecret(): string {
  return process.env.GARMIN_CLIENT_SECRET ?? "";
}

const oauthConfig: ProviderOAuthConfig = {
  get tokenUrl() {
    return GARMIN_TOKEN;
  },
  get clientId() {
    return clientId();
  },
  get clientSecret() {
    return clientSecret();
  },
};

export const garminManifest: ProviderManifest = {
  id: "garmin",
  displayName: "Garmin",
  credentialKind: "oauth",
  credentialAdapter: oauthCredentialAdapter as ProviderManifest["credentialAdapter"],
  oauthConfig,
  pkce: true,
  // No instance credentials → no Garmin row on the connections page.
  // (Garmin program keys are per-operator; self-hosted instances
  // without one must not render a dead Connect button.)
  configured: () => clientId().length > 0,
  // Backfill requester, not a pick list — Garmin has no list endpoint.
  importUrl: "/sync/import/garmin",

  buildAuthUrl(redirectUri, state, extras): string {
    const params = new URLSearchParams({
      client_id: clientId(),
      response_type: "code",
      redirect_uri: redirectUri,
      state,
    });
    if (extras?.codeChallenge) {
      params.set("code_challenge", extras.codeChallenge);
      params.set("code_challenge_method", "S256");
    }
    return `${GARMIN_AUTHORIZE}?${params}`;
  },

  async exchangeCode(
    code,
    redirectUri,
    extras,
  ): Promise<{
    credentials: OAuthCredentials;
    providerUserId: string | null;
    grantedScopes: string[];
  }> {
    const resp = await fetch(GARMIN_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId(),
        client_secret: clientSecret(),
        code,
        code_verifier: extras?.codeVerifier ?? "",
        redirect_uri: redirectUri,
      }).toString(),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Garmin token exchange failed: ${resp.status} ${text}`);
    }
    const data = (await resp.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope?: string;
    };

    // Garmin user id — needed to route webhook notifications to the
    // right local user.
    const userResp = await fetch(`${GARMIN_API}/wellness-api/rest/user/id`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const user = userResp.ok
      ? ((await userResp.json()) as { userId?: string })
      : null;

    return {
      credentials: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      },
      providerUserId: user?.userId ?? null,
      grantedScopes: data.scope ? data.scope.split(" ") : [],
    };
  },

  webhookReceiver: garminWebhook,
};
