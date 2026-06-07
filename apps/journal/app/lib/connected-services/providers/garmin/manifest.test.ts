// Manifest contract tests (spec: garmin-import, "Connect Garmin
// account" + PKCE parameters + env gating).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../../manager.ts", () => ({
  getServiceByProviderUser: vi.fn(),
  markRevoked: vi.fn(),
  getServiceById: vi.fn(),
  withFreshCredentials: vi.fn(),
}));
vi.mock("../../../boss.server.ts", () => ({ enqueueOptional: vi.fn() }));
vi.mock("../../../sync/imports.server.ts", () => ({
  isAlreadyImported: vi.fn(),
  importActivity: vi.fn(),
}));
vi.mock("../../../db.ts", () => ({ getDb: () => ({}) }));

const { garminManifest } = await import("./manifest.ts");

const ENV_KEYS = ["GARMIN_CLIENT_ID", "GARMIN_CLIENT_SECRET"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("garminManifest", () => {
  it("declares oauth + PKCE, no pick-list importer, custom import page", () => {
    expect(garminManifest.id).toBe("garmin");
    expect(garminManifest.credentialKind).toBe("oauth");
    expect(garminManifest.pkce).toBe(true);
    expect(garminManifest.importer).toBeUndefined();
    expect(garminManifest.importUrl).toBe("/sync/import/garmin");
    expect(garminManifest.webhookReceiver).toBeDefined();
  });

  it("is hidden without instance credentials, shown with them", () => {
    delete process.env.GARMIN_CLIENT_ID;
    expect(garminManifest.configured!()).toBe(false);
    process.env.GARMIN_CLIENT_ID = "test-client";
    expect(garminManifest.configured!()).toBe(true);
  });

  it("buildAuthUrl carries the S256 code challenge", () => {
    process.env.GARMIN_CLIENT_ID = "test-client";
    const url = new URL(
      garminManifest.buildAuthUrl!(
        "https://journal.example/api/sync/callback/garmin",
        "state-123",
        { codeChallenge: "challenge-abc" },
      ),
    );
    expect(url.origin + url.pathname).toBe("https://connect.garmin.com/oauth2Confirm");
    expect(url.searchParams.get("client_id")).toBe("test-client");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-abc");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("state-123");
  });
});
