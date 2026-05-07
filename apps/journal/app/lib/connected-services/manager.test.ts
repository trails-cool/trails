import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ConnectionNotActiveError,
  NeedsRelinkError,
  type CredentialAdapter,
  type OAuthCredentials,
  type ProviderOAuthConfig,
} from "./types.ts";
import type { ProviderManifest } from "./registry.ts";

// ---- DB mock ----
type Row = {
  id: string;
  userId: string;
  provider: string;
  credentialKind: string;
  credentials: unknown;
  status: string;
  providerUserId: string | null;
  grantedScopes: string[];
  createdAt: Date;
};

const rows: Row[] = [];

const mockDb = {
  select: () => ({
    from: () => ({
      where: () => Promise.resolve(rows.slice()),
    }),
  }),
  insert: () => ({
    values: (v: Row) => {
      rows.push(v);
      return Promise.resolve();
    },
  }),
  update: () => ({
    set: (patch: Partial<Row>) => ({
      where: (cond: unknown) => {
        // The cond from drizzle is opaque to us; in this test we always
        // patch the most recently-inserted row.
        void cond;
        const row = rows[rows.length - 1];
        if (row) Object.assign(row, patch);
        return Promise.resolve();
      },
    }),
  }),
  delete: () => ({
    where: () => {
      rows.length = 0;
      return Promise.resolve();
    },
  }),
};

vi.mock("../db.ts", () => ({ getDb: () => mockDb }));

// ---- Manifest / adapter stubs ----
const refreshSpy = vi.fn();
const revokeSpy = vi.fn();
const isExpiredSpy = vi.fn();

const stubAdapter: CredentialAdapter<OAuthCredentials> = {
  isExpired: (creds) => isExpiredSpy(creds),
  refresh: (creds, cfg) => refreshSpy(creds, cfg),
  revoke: (creds, cfg) => revokeSpy(creds, cfg),
};

const stubOauthConfig: ProviderOAuthConfig = {
  tokenUrl: "https://example.test/oauth/token",
  clientId: "cid",
  clientSecret: "secret",
  revokeUrl: "https://example.test/v1/permissions",
};

const stubManifest: ProviderManifest = {
  id: "stub",
  displayName: "Stub",
  credentialKind: "oauth",
  credentialAdapter: stubAdapter as CredentialAdapter,
  oauthConfig: stubOauthConfig,
};

vi.mock("./registry.ts", async () => {
  const actual = await vi.importActual<typeof import("./registry.ts")>("./registry.ts");
  return {
    ...actual,
    getManifest: (id: string) => (id === "stub" ? stubManifest : null),
  };
});

// Import after mocks are wired.
const {
  link,
  unlink,
  unlinkByUserProvider,
  markNeedsRelink,
  withFreshCredentials,
  getService,
} = await import("./manager.ts");

beforeEach(() => {
  rows.length = 0;
  refreshSpy.mockReset();
  revokeSpy.mockReset();
  isExpiredSpy.mockReset();
});

describe("ConnectedServiceManager.link", () => {
  it("inserts a row with the active status and supplied fields", async () => {
    const svc = await link({
      userId: "u1",
      provider: "stub",
      credentialKind: "oauth",
      credentials: { access_token: "a", refresh_token: "r", expires_at: new Date().toISOString() },
      providerUserId: "pu1",
      grantedScopes: ["read"],
    });
    expect(svc.userId).toBe("u1");
    expect(svc.provider).toBe("stub");
    expect(svc.status).toBe("active");
    expect(svc.grantedScopes).toEqual(["read"]);
    expect(rows).toHaveLength(1);
  });
});

describe("ConnectedServiceManager.withFreshCredentials", () => {
  const freshCreds: OAuthCredentials = {
    access_token: "a",
    refresh_token: "r",
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
  };

  async function seed(status: "active" | "needs_relink" | "revoked" = "active") {
    await link({
      userId: "u1",
      provider: "stub",
      credentialKind: "oauth",
      credentials: freshCreds,
    });
    if (status !== "active") rows[0]!.status = status;
    return rows[0]!.id;
  }

  it("calls fn directly when credentials are not expired", async () => {
    const id = await seed();
    isExpiredSpy.mockReturnValue(false);

    const result = await withFreshCredentials(id, async (creds) => {
      expect(creds).toEqual(freshCreds);
      return "ok";
    });

    expect(result).toBe("ok");
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it("refreshes credentials and persists new blob when expired", async () => {
    const id = await seed();
    isExpiredSpy.mockReturnValue(true);
    const newCreds: OAuthCredentials = {
      access_token: "a2",
      refresh_token: "r2",
      expires_at: new Date(Date.now() + 7200_000).toISOString(),
    };
    refreshSpy.mockResolvedValue(newCreds);

    const got = await withFreshCredentials(id, async (creds) => creds as OAuthCredentials);

    expect(refreshSpy).toHaveBeenCalledWith(freshCreds, stubOauthConfig);
    expect(got).toEqual(newCreds);
    expect(rows[0]!.credentials).toEqual(newCreds);
  });

  it("flips status to needs_relink and re-throws when refresh raises NeedsRelinkError", async () => {
    const id = await seed();
    isExpiredSpy.mockReturnValue(true);
    refreshSpy.mockRejectedValue(new NeedsRelinkError("revoked"));

    await expect(
      withFreshCredentials(id, async () => "never"),
    ).rejects.toBeInstanceOf(NeedsRelinkError);
    expect(rows[0]!.status).toBe("needs_relink");
  });

  it("rejects with ConnectionNotActiveError when status is not active", async () => {
    const id = await seed("needs_relink");
    isExpiredSpy.mockReturnValue(false);

    await expect(
      withFreshCredentials(id, async () => "never"),
    ).rejects.toBeInstanceOf(ConnectionNotActiveError);
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});

describe("ConnectedServiceManager.markNeedsRelink", () => {
  it("flips the row's status", async () => {
    await link({
      userId: "u1",
      provider: "stub",
      credentialKind: "oauth",
      credentials: { access_token: "a", refresh_token: "r", expires_at: new Date().toISOString() },
    });
    await markNeedsRelink(rows[0]!.id, "test");
    expect(rows[0]!.status).toBe("needs_relink");
  });
});

describe("ConnectedServiceManager.unlink", () => {
  it("calls the credential adapter's revoke before deletion", async () => {
    await link({
      userId: "u1",
      provider: "stub",
      credentialKind: "oauth",
      credentials: { access_token: "a", refresh_token: "r", expires_at: new Date().toISOString() },
    });
    revokeSpy.mockResolvedValue(undefined);
    await unlink(rows[0]?.id ?? "missing");
    expect(revokeSpy).toHaveBeenCalled();
  });

  it("swallows revoke failures and still deletes locally", async () => {
    await link({
      userId: "u1",
      provider: "stub",
      credentialKind: "oauth",
      credentials: { access_token: "a", refresh_token: "r", expires_at: new Date().toISOString() },
    });
    const id = rows[0]!.id;
    revokeSpy.mockRejectedValue(new Error("provider down"));
    await expect(unlink(id)).resolves.toBeUndefined();
    expect(rows).toHaveLength(0);
  });
});

// Reference unused symbols to keep the linter happy under strict noUnused rules.
void unlinkByUserProvider;
void getService;
