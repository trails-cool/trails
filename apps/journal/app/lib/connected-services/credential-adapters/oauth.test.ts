import { describe, it, expect, beforeEach, vi } from "vitest";
import { oauthCredentialAdapter } from "./oauth.ts";
import {
  NeedsRelinkError,
  type OAuthCredentials,
  type ProviderOAuthConfig,
} from "../types.ts";

const config: ProviderOAuthConfig = {
  tokenUrl: "https://example.test/oauth/token",
  clientId: "cid",
  clientSecret: "secret",
  revokeUrl: "https://example.test/v1/permissions",
};

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
});

describe("oauthCredentialAdapter.isExpired", () => {
  it("returns true when expires_at is in the past", () => {
    const creds: OAuthCredentials = {
      access_token: "a",
      refresh_token: "r",
      expires_at: new Date(Date.now() - 1000).toISOString(),
    };
    expect(oauthCredentialAdapter.isExpired(creds)).toBe(true);
  });

  it("returns true within the refresh skew window (60s)", () => {
    const creds: OAuthCredentials = {
      access_token: "a",
      refresh_token: "r",
      expires_at: new Date(Date.now() + 30_000).toISOString(),
    };
    expect(oauthCredentialAdapter.isExpired(creds)).toBe(true);
  });

  it("returns false when expires_at is comfortably in the future", () => {
    const creds: OAuthCredentials = {
      access_token: "a",
      refresh_token: "r",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    };
    expect(oauthCredentialAdapter.isExpired(creds)).toBe(false);
  });
});

describe("oauthCredentialAdapter.refresh", () => {
  const stale: OAuthCredentials = {
    access_token: "old",
    refresh_token: "rt",
    expires_at: new Date(Date.now() - 1000).toISOString(),
  };

  it("posts refresh_token grant and returns new credentials", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 3600,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const fresh = await oauthCredentialAdapter.refresh(stale, config);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(config.tokenUrl);
    expect((init as RequestInit).method).toBe("POST");
    const body = (init as RequestInit).body as string;
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=rt");
    expect(body).toContain("client_id=cid");
    expect(fresh.access_token).toBe("new-access");
    expect(fresh.refresh_token).toBe("new-refresh");
    expect(new Date(fresh.expires_at).getTime()).toBeGreaterThan(Date.now() + 3500_000);
  });

  it("retains the original refresh_token when the response omits one", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "new-access", expires_in: 3600 }),
        { status: 200 },
      ),
    );
    const fresh = await oauthCredentialAdapter.refresh(stale, config);
    expect(fresh.refresh_token).toBe("rt");
  });

  it("throws NeedsRelinkError on 4xx (revoked refresh token)", async () => {
    fetchSpy.mockResolvedValue(new Response("invalid_grant", { status: 400 }));
    await expect(oauthCredentialAdapter.refresh(stale, config)).rejects.toBeInstanceOf(
      NeedsRelinkError,
    );
  });

  it("throws a regular Error on 5xx (transient)", async () => {
    fetchSpy.mockResolvedValue(new Response("server error", { status: 503 }));
    await expect(oauthCredentialAdapter.refresh(stale, config)).rejects.not.toBeInstanceOf(
      NeedsRelinkError,
    );
  });
});

describe("oauthCredentialAdapter.revoke", () => {
  const creds: OAuthCredentials = {
    access_token: "a",
    refresh_token: "r",
    expires_at: new Date().toISOString(),
  };

  it("DELETEs the revoke URL with the access token", async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 204 }));
    await oauthCredentialAdapter.revoke!(creds, config);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(config.revokeUrl);
    expect((init as RequestInit).method).toBe("DELETE");
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe(
      "Bearer a",
    );
  });

  it("swallows network errors silently", async () => {
    fetchSpy.mockRejectedValue(new Error("network down"));
    await expect(oauthCredentialAdapter.revoke!(creds, config)).resolves.toBeUndefined();
  });

  it("is a no-op when no revokeUrl is configured", async () => {
    await oauthCredentialAdapter.revoke!(creds, { ...config, revokeUrl: undefined });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
