// Wahoo provider manifest. Declares credential kind, OAuth config,
// authorization/exchange flows, and capability adapters.
//
// Adding to the registry happens via providers/index.ts which imports each
// provider's barrel. Don't `import`-cycle this file from registry.ts.

import { oauthCredentialAdapter } from "../../credential-adapters/oauth.ts";
import type {
  ProviderManifest,
  CapabilityContext,
} from "../../registry.ts";
import type { OAuthCredentials, ProviderOAuthConfig } from "../../types.ts";
import { wahooImporter } from "./importer.ts";
import { wahooPusher } from "./pusher.ts";
import { wahooWebhook } from "./webhook.ts";

const WAHOO_API = "https://api.wahooligan.com";
const WAHOO_AUTH = "https://api.wahooligan.com/oauth";

const SCOPES = [
  "workouts_read",
  "user_read",
  "offline_data",
  "routes_read",
  "routes_write",
];

function clientId(): string {
  return process.env.WAHOO_CLIENT_ID ?? "";
}
function clientSecret(): string {
  return process.env.WAHOO_CLIENT_SECRET ?? "";
}

const oauthConfig: ProviderOAuthConfig = {
  get tokenUrl() {
    return `${WAHOO_AUTH}/token`;
  },
  get clientId() {
    return clientId();
  },
  get clientSecret() {
    return clientSecret();
  },
  get revokeUrl() {
    return `${WAHOO_API}/v1/permissions`;
  },
};

export const wahooManifest: ProviderManifest = {
  id: "wahoo",
  displayName: "Wahoo",
  credentialKind: "oauth",
  credentialAdapter: oauthCredentialAdapter as ProviderManifest["credentialAdapter"],
  oauthConfig,
  scopes: SCOPES,

  buildAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: clientId(),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      state,
    });
    return `${WAHOO_AUTH}/authorize?${params}`;
  },

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<{
    credentials: OAuthCredentials;
    providerUserId: string | null;
    grantedScopes: string[];
  }> {
    const resp = await fetch(`${WAHOO_AUTH}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId(),
        client_secret: clientSecret(),
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const err = new Error(`Wahoo token exchange failed: ${resp.status} ${text}`);
      // Attach a code so callers can distinguish the "too many tokens" sandbox case.
      (err as Error & { code?: string }).code = text.includes("Too many unrevoked access tokens")
        ? "too_many_tokens"
        : "generic";
      throw err;
    }
    const data = (await resp.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Pull provider user id so webhook routing works.
    const userResp = await fetch(`${WAHOO_API}/v1/user`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const user = userResp.ok
      ? ((await userResp.json()) as { id: number })
      : null;

    return {
      credentials: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      },
      providerUserId: user?.id != null ? String(user.id) : null,
      // Wahoo does not return a `scope` field and grants scopes
      // all-or-nothing, so the requested set is the granted set.
      grantedScopes: SCOPES,
    };
  },

  importer: wahooImporter,
  routePusher: wahooPusher,
  webhookReceiver: wahooWebhook,
};

// Re-export the capability adapters for direct testing access if needed.
export type { CapabilityContext };
