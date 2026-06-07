// PKCE helper tests (RFC 7636 S256) — spec: garmin-import, task 1.2.

import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  generatePkcePair,
  pkceCookieHeader,
  readPkceVerifier,
  clearPkceCookieHeader,
  encodeOAuthState,
  decodeOAuthState,
} from "./oauth-state.server.ts";

describe("generatePkcePair", () => {
  it("produces an RFC 7636-compliant verifier and matching S256 challenge", () => {
    const { verifier, challenge } = generatePkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/); // base64url charset
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(challenge).toBe(expected);
  });

  it("is unique per call", () => {
    expect(generatePkcePair().verifier).not.toBe(generatePkcePair().verifier);
  });
});

describe("PKCE cookie round trip", () => {
  it("verifier set on connect is readable on callback", () => {
    const { verifier } = generatePkcePair();
    const setCookie = pkceCookieHeader(verifier);
    // Browser reflects the cookie value back on the callback request.
    const cookieValue = setCookie.split(";")[0]!;
    const request = new Request("https://x.example/api/sync/callback/garmin", {
      headers: { Cookie: `other=1; ${cookieValue}` },
    });
    expect(readPkceVerifier(request)).toBe(verifier);
  });

  it("returns null without the cookie; clear header expires it", () => {
    const request = new Request("https://x.example/", { headers: { Cookie: "other=1" } });
    expect(readPkceVerifier(request)).toBeNull();
    expect(clearPkceCookieHeader()).toContain("Max-Age=0");
  });

  it("cookie is httpOnly and scoped to the callback path", () => {
    const header = pkceCookieHeader("v");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Path=/api/sync/callback");
  });
});

describe("oauth state encoding (pre-existing behavior)", () => {
  it("round-trips and tolerates garbage", () => {
    const encoded = encodeOAuthState({ returnTo: "/settings/connections" });
    expect(decodeOAuthState(encoded)).toEqual({ returnTo: "/settings/connections" });
    expect(decodeOAuthState("%%%not-base64%%%")).toEqual({});
    expect(decodeOAuthState(null)).toEqual({});
  });
});
