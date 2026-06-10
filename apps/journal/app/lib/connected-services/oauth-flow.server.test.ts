import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const link = vi.fn();
vi.mock("./manager.ts", () => ({
  link: (...args: unknown[]) => link(...args),
}));
vi.mock("../config.server.ts", () => ({
  getOrigin: () => "https://journal.test",
}));

import { initiateOAuthFlow, completeOAuthFlow } from "./oauth-flow.server.ts";
import { decodeOAuthState } from "./oauth-state.server.ts";
import type { ProviderManifest } from "./registry.ts";

function fakeManifest(overrides: Partial<ProviderManifest> = {}): ProviderManifest {
  return {
    id: "fakeprov",
    displayName: "Fake Provider",
    credentialKind: "oauth",
    credentialAdapter: { isExpired: () => false, refresh: vi.fn() },
    buildAuthUrl: vi.fn(
      (redirectUri: string, state: string, extras?: { codeChallenge?: string }) =>
        `https://provider.test/authorize?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}` +
        (extras?.codeChallenge ? `&code_challenge=${extras.codeChallenge}` : ""),
    ),
    exchangeCode: vi.fn(),
    ...overrides,
  } as unknown as ProviderManifest;
}

function callbackRequest(params: Record<string, string>, cookie?: string): Request {
  const url = new URL("https://journal.test/api/sync/callback/fakeprov");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url, { headers: cookie ? { Cookie: cookie } : {} });
}

beforeEach(() => vi.clearAllMocks());

describe("initiateOAuthFlow", () => {
  it("redirects to the provider with the intent in the state, no cookie for non-PKCE", () => {
    const manifest = fakeManifest();
    const resp = initiateOAuthFlow(manifest, { returnTo: "/settings/connections" });

    expect(resp.status).toBe(302);
    const location = new URL(resp.headers.get("Location")!);
    expect(location.origin).toBe("https://provider.test");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://journal.test/api/sync/callback/fakeprov",
    );
    expect(decodeOAuthState(location.searchParams.get("state"))).toEqual({
      returnTo: "/settings/connections",
    });
    expect(resp.headers.get("Set-Cookie")).toBeNull();
  });

  it("PKCE: sets the verifier cookie and sends its S256 challenge", () => {
    const manifest = fakeManifest({ pkce: true });
    const resp = initiateOAuthFlow(manifest, { pushAfter: { routeId: "r-1" }, returnTo: "/r" });

    const cookie = resp.headers.get("Set-Cookie")!;
    expect(cookie).toContain("__oauth_pkce=");
    expect(cookie).toContain("HttpOnly");
    const verifier = cookie.match(/__oauth_pkce=([^;]+)/)![1]!;

    const location = new URL(resp.headers.get("Location")!);
    const expectedChallenge = createHash("sha256").update(verifier).digest("base64url");
    expect(location.searchParams.get("code_challenge")).toBe(expectedChallenge);
    // push intent rides the state even on the PKCE path
    expect(decodeOAuthState(location.searchParams.get("state"))).toEqual({
      pushAfter: { routeId: "r-1" },
      returnTo: "/r",
    });
  });
});

describe("completeOAuthFlow", () => {
  it("maps access_denied to denied with decoded state", async () => {
    const manifest = fakeManifest();
    const state = new URL(
      initiateOAuthFlow(manifest, { returnTo: "/x" }).headers.get("Location")!,
    ).searchParams.get("state")!;

    const result = await completeOAuthFlow(
      manifest,
      callbackRequest({ error: "access_denied", state }),
      "user-1",
    );
    expect(result).toEqual({ status: "denied", state: { returnTo: "/x" } });
    expect(link).not.toHaveBeenCalled();
  });

  it("returns missing_code when no code param", async () => {
    const result = await completeOAuthFlow(fakeManifest(), callbackRequest({}), "user-1");
    expect(result.status).toBe("missing_code");
  });

  it("PKCE: returns missing_verifier when the cookie is gone", async () => {
    const result = await completeOAuthFlow(
      fakeManifest({ pkce: true }),
      callbackRequest({ code: "abc" }),
      "user-1",
    );
    expect(result.status).toBe("missing_verifier");
  });

  it("exchanges the code and links the connection", async () => {
    const manifest = fakeManifest();
    (manifest.exchangeCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      credentials: { accessToken: "t" },
      providerUserId: "prov-9",
      grantedScopes: ["routes_write"],
    });

    const result = await completeOAuthFlow(manifest, callbackRequest({ code: "abc" }), "user-1");

    expect(result.status).toBe("linked");
    expect(manifest.exchangeCode).toHaveBeenCalledWith(
      "abc",
      "https://journal.test/api/sync/callback/fakeprov",
      undefined,
    );
    expect(link).toHaveBeenCalledWith({
      userId: "user-1",
      provider: "fakeprov",
      credentialKind: "oauth",
      credentials: { accessToken: "t" },
      providerUserId: "prov-9",
      grantedScopes: ["routes_write"],
    });
  });

  it("PKCE: passes the cookie verifier to exchangeCode", async () => {
    const manifest = fakeManifest({ pkce: true });
    (manifest.exchangeCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      credentials: {},
      providerUserId: "p",
      grantedScopes: [],
    });

    await completeOAuthFlow(
      manifest,
      callbackRequest({ code: "abc" }, "__oauth_pkce=my-verifier"),
      "user-1",
    );
    expect(manifest.exchangeCode).toHaveBeenCalledWith(
      "abc",
      expect.any(String),
      { codeVerifier: "my-verifier" },
    );
  });

  it("maps exchange failures to error with the provider code", async () => {
    const manifest = fakeManifest();
    (manifest.exchangeCode as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error("nope"), { code: "rate_limited" }),
    );

    const result = await completeOAuthFlow(manifest, callbackRequest({ code: "x" }), "user-1");
    expect(result).toMatchObject({ status: "error", code: "rate_limited" });
  });
});
