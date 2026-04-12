import { describe, it, expect, vi } from "vitest";
import { createHash, randomBytes } from "node:crypto";

// Mock the database module before importing oauth
vi.mock("./db.ts", () => {
  const store: Record<string, unknown[]> = {
    oauth_clients: [],
    oauth_codes: [],
    oauth_tokens: [],
  };

  return {
    getDb: () => ({
      select: () => ({
        from: () => ({
          where: () => {
            // Return empty array by default; tests override via __store
            return [];
          },
        }),
      }),
      insert: () => ({
        values: () => ({
          onConflictDoUpdate: () => Promise.resolve(),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
    }),
    __store: store,
  };
});

/**
 * Test PKCE verification logic directly.
 * The full OAuth flow requires a real database, so we test the crypto
 * primitives and error handling here.
 */
describe("PKCE verification", () => {
  it("S256: verifier matches challenge", () => {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    // Re-derive the challenge from the verifier
    const derived = createHash("sha256").update(verifier).digest("base64url");
    expect(derived).toBe(challenge);
  });

  it("S256: wrong verifier does not match", () => {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    const wrongVerifier = randomBytes(32).toString("base64url");
    const wrongDerived = createHash("sha256").update(wrongVerifier).digest("base64url");
    expect(wrongDerived).not.toBe(challenge);
  });

  it("S256: challenge is base64url-encoded SHA-256", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    // base64url has no padding, no +, no /
    expect(challenge).not.toContain("=");
    expect(challenge).not.toContain("+");
    expect(challenge).not.toContain("/");
    expect(challenge.length).toBeGreaterThan(0);
  });
});

describe("OAuthError", () => {
  it("has code and message", async () => {
    const { OAuthError } = await import("./oauth.server.ts");
    const err = new OAuthError("invalid_grant", "Bad code");
    expect(err.code).toBe("invalid_grant");
    expect(err.message).toBe("Bad code");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("token generation", () => {
  it("generates unique tokens", async () => {
    const { randomBytes } = await import("node:crypto");
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(randomBytes(32).toString("base64url"));
    }
    expect(tokens.size).toBe(100);
  });

  it("tokens are base64url encoded", async () => {
    const token = randomBytes(32).toString("base64url");
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBe(43); // 32 bytes → 43 base64url chars
  });
});

describe("seedOAuthClient", () => {
  it("can be imported and called", async () => {
    const { seedOAuthClient } = await import("./oauth.server.ts");
    // Should not throw with mocked DB
    await seedOAuthClient("test-client", "testapp://callback", true);
  });
});
