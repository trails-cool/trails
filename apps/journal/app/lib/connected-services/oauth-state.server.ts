// OAuth state encoding for the connect/callback flow. The state param is
// reflected back to the callback unchanged, so we use it to carry
// post-callback intent (where to return to, whether a push should resume).

export interface PushOAuthState {
  pushAfter?: { routeId: string };
  returnTo?: string;
}

export function encodeOAuthState(state: PushOAuthState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeOAuthState(raw: string | null | undefined): PushOAuthState {
  if (!raw) return {};
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as PushOAuthState;
    return typeof parsed === "object" && parsed != null ? parsed : {};
  } catch {
    return {};
  }
}

// --- PKCE (RFC 7636) ----------------------------------------------------
//
// Providers with `pkce: true` (Garmin) need a code verifier that survives
// the connect → provider → callback redirect without ever appearing in a
// URL (the whole point of PKCE is that the verifier stays out of the
// authorization response). The `state` param is visible in redirects, so
// the verifier rides a short-lived httpOnly cookie scoped to the callback
// path instead.

import { createHash, randomBytes } from "node:crypto";

const PKCE_COOKIE = "__oauth_pkce";
const PKCE_MAX_AGE_S = 600;

export function generatePkcePair(): { verifier: string; challenge: string } {
  // 32 random bytes → 43-char base64url verifier (within RFC 7636's 43–128).
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function pkceCookieHeader(verifier: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${PKCE_COOKIE}=${verifier}; Max-Age=${PKCE_MAX_AGE_S}; Path=/api/sync/callback; HttpOnly; SameSite=Lax${secure}`;
}

export function clearPkceCookieHeader(): string {
  return `${PKCE_COOKIE}=; Max-Age=0; Path=/api/sync/callback; HttpOnly; SameSite=Lax`;
}

export function readPkceVerifier(request: Request): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${PKCE_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}
