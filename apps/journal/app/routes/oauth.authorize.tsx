import type { Route } from "./+types/oauth.authorize";
import { redirect } from "react-router";
import { getSessionUser } from "../lib/auth.server.ts";
import {
  getOAuthClient,
  validateRedirectUri,
  createAuthorizationCode,
} from "../lib/oauth.server.ts";

/**
 * GET /oauth/authorize
 *
 * OAuth2 authorization endpoint. If the user is already logged in,
 * generates an authorization code and redirects. Otherwise redirects
 * to the login page with a return URL.
 *
 * Query params:
 * - client_id
 * - redirect_uri
 * - code_challenge
 * - code_challenge_method (default: S256)
 * - response_type (must be "code")
 * - state (opaque, passed back to client)
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") ?? "S256";
  const responseType = url.searchParams.get("response_type");
  const state = url.searchParams.get("state") ?? "";

  // Validate required params
  if (!clientId || !redirectUri || !codeChallenge || responseType !== "code") {
    return new Response(
      JSON.stringify({ error: "invalid_request", error_description: "Missing required parameters" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (codeChallengeMethod !== "S256" && codeChallengeMethod !== "plain") {
    return new Response(
      JSON.stringify({ error: "invalid_request", error_description: "Unsupported code_challenge_method" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Validate client
  const client = await getOAuthClient(clientId);
  if (!client || !validateRedirectUri(client, redirectUri)) {
    return new Response(
      JSON.stringify({ error: "invalid_client", error_description: "Unknown client or redirect URI" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Check if user is already authenticated
  const user = await getSessionUser(request);
  if (!user) {
    // Redirect to login with return URL so we come back here after auth
    const returnUrl = url.pathname + url.search;
    return redirect(`/auth/login?returnTo=${encodeURIComponent(returnUrl)}`);
  }

  // User is authenticated — issue code and redirect to client
  const code = await createAuthorizationCode({
    userId: user.id,
    clientId,
    codeChallenge,
    codeChallengeMethod,
    redirectUri,
  });

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", code);
  if (state) callbackUrl.searchParams.set("state", state);

  return redirect(callbackUrl.toString());
}
