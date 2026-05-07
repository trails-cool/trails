// OAuth2 CredentialAdapter. Implements the standard refresh_token + revoke
// flow against any provider whose token endpoint follows the OAuth2 RFC.
//
// Provider-specific URLs and client credentials come from the provider's
// manifest via ProviderOAuthConfig — Wahoo, future Strava/Garmin/Coros
// share this adapter and supply their own endpoints.
//
// The adapter does not write to the database; it returns refreshed
// credentials for ConnectedServiceManager to persist.

import {
  NeedsRelinkError,
  type CredentialAdapter,
  type OAuthCredentials,
  type ProviderOAuthConfig,
} from "../types.ts";

// Refresh credentials slightly before they actually expire so a token in
// the middle of a long-running operation doesn't tip over mid-request.
const REFRESH_SKEW_MS = 60_000;

function parseExpiresAt(iso: string): Date {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    throw new Error(`OAuth credentials have invalid expires_at: ${iso}`);
  }
  return d;
}

export const oauthCredentialAdapter: CredentialAdapter<OAuthCredentials> = {
  isExpired(creds) {
    return parseExpiresAt(creds.expires_at).getTime() - Date.now() < REFRESH_SKEW_MS;
  },

  async refresh(creds, providerConfig): Promise<OAuthCredentials> {
    const resp = await fetch(providerConfig.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        grant_type: "refresh_token",
        refresh_token: creds.refresh_token,
      }).toString(),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      // 4xx on refresh = revoked / invalidated refresh token. Caller must re-link.
      // 5xx = transient; surface as a regular Error so caller can retry the operation.
      if (resp.status >= 400 && resp.status < 500) {
        throw new NeedsRelinkError(
          `OAuth refresh rejected (${resp.status}): ${text || "no body"}`,
        );
      }
      throw new Error(`OAuth refresh failed (${resp.status}): ${text}`);
    }

    const data = (await resp.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    return {
      access_token: data.access_token,
      // Some providers omit refresh_token on refresh (it stays the same).
      refresh_token: data.refresh_token ?? creds.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  },

  async revoke(creds, providerConfig) {
    if (!providerConfig.revokeUrl) return;
    // Best-effort. Caller deletes the local row regardless of outcome.
    await fetch(providerConfig.revokeUrl, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${creds.access_token}` },
    }).catch(() => {
      // Swallow — local unlink proceeds.
    });
  },
};
