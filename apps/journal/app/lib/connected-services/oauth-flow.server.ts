// The OAuth connect → callback lifecycle as one module. Routes stay
// thin adapters: they look up the manifest, call initiate/complete,
// and map the result to redirects. Everything protocol-shaped —
// state encoding, PKCE pair generation, the verifier cookie's
// lifecycle, redirect-URI construction, code exchange, linking the
// connection — lives here, so the next OAuth provider (Coros, Strava)
// reuses the flow instead of the pattern.

import { redirect } from "react-router";
import { getOrigin } from "../config.server.ts";
import { link } from "./manager.ts";
import type { ProviderManifest } from "./registry.ts";
import {
  clearPkceCookieHeader,
  decodeOAuthState,
  encodeOAuthState,
  generatePkcePair,
  pkceCookieHeader,
  readPkceVerifier,
  type PushOAuthState,
} from "./oauth-state.server.ts";

function callbackUri(manifest: ProviderManifest): string {
  return `${getOrigin()}/api/sync/callback/${manifest.id}`;
}

/**
 * Build the provider authorization redirect. Encodes post-callback
 * intent into the state param and, for PKCE providers, sets the
 * httpOnly verifier cookie — including when the flow is initiated
 * from a push-resume (the old inline code only handled PKCE on the
 * plain connect path).
 *
 * Caller must have verified `manifest.buildAuthUrl` exists.
 */
export function initiateOAuthFlow(
  manifest: ProviderManifest,
  intent: PushOAuthState,
): Response {
  if (!manifest.buildAuthUrl) {
    throw new Error(`Provider ${manifest.id} has no buildAuthUrl`);
  }
  const state = encodeOAuthState(intent);
  const redirectUri = callbackUri(manifest);

  if (manifest.pkce) {
    const { verifier, challenge } = generatePkcePair();
    return redirect(manifest.buildAuthUrl(redirectUri, state, { codeChallenge: challenge }), {
      headers: { "Set-Cookie": pkceCookieHeader(verifier) },
    });
  }
  return redirect(manifest.buildAuthUrl(redirectUri, state));
}

export type OAuthCompletion =
  /** Provider sent the user back with access_denied. */
  | { status: "denied"; state: PushOAuthState }
  /** No authorization code in the callback URL. */
  | { status: "missing_code"; state: PushOAuthState }
  /** PKCE provider but the verifier cookie is gone (expired / cleared). */
  | { status: "missing_verifier"; state: PushOAuthState }
  /** Code exchange or linking failed; `code` is provider-specific or "sync_failed". */
  | { status: "error"; code: string; state: PushOAuthState }
  /** Connection linked. */
  | { status: "linked"; state: PushOAuthState };

/**
 * Consume the provider callback: decode state, recover the PKCE
 * verifier, exchange the code, and link the connection. Never throws —
 * every outcome is a variant the route maps to a redirect. The spent
 * verifier cookie should be cleared on whatever response the route
 * returns (`clearPkceCookieHeader`).
 */
export async function completeOAuthFlow(
  manifest: ProviderManifest,
  request: Request,
  userId: string,
): Promise<OAuthCompletion> {
  if (!manifest.exchangeCode) {
    throw new Error(`Provider ${manifest.id} has no exchangeCode`);
  }
  const url = new URL(request.url);
  const state = decodeOAuthState(url.searchParams.get("state"));

  if (url.searchParams.get("error") === "access_denied") {
    return { status: "denied", state };
  }

  const code = url.searchParams.get("code");
  if (!code) return { status: "missing_code", state };

  const codeVerifier = manifest.pkce ? readPkceVerifier(request) : null;
  if (manifest.pkce && !codeVerifier) {
    return { status: "missing_verifier", state };
  }

  try {
    const exchange = await manifest.exchangeCode(
      code,
      callbackUri(manifest),
      codeVerifier ? { codeVerifier } : undefined,
    );
    await link({
      userId,
      provider: manifest.id,
      credentialKind: manifest.credentialKind,
      credentials: exchange.credentials as Record<string, unknown>,
      providerUserId: exchange.providerUserId,
      grantedScopes: exchange.grantedScopes,
    });
    return { status: "linked", state };
  } catch (e) {
    // Log only the error message, never the raw exception object — a
    // provider's thrown error can embed the authorization code or token
    // exchange response, which would then land in logs / Sentry.
    console.error(
      `OAuth callback failed for ${manifest.id}:`,
      e instanceof Error ? e.message : String(e),
    );
    const code =
      typeof (e as { code?: string }).code === "string"
        ? (e as { code: string }).code
        : "sync_failed";
    return { status: "error", code, state };
  }
}

export { clearPkceCookieHeader };
