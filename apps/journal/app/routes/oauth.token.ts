import type { Route } from "./+types/oauth.token";
import {
  exchangeCodeForTokens,
  refreshAccessToken,
  OAuthError,
} from "../lib/oauth.server.ts";

/**
 * POST /oauth/token
 *
 * OAuth2 token endpoint. Supports two grant types:
 * - authorization_code: Exchange code + PKCE verifier for tokens
 * - refresh_token: Exchange refresh token for new token pair
 */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const body = await request.formData();
  const grantType = body.get("grant_type") as string | null;

  try {
    if (grantType === "authorization_code") {
      const code = body.get("code") as string | null;
      const clientId = body.get("client_id") as string | null;
      const redirectUri = body.get("redirect_uri") as string | null;
      const codeVerifier = body.get("code_verifier") as string | null;

      if (!code || !clientId || !redirectUri || !codeVerifier) {
        return oauthErrorResponse("invalid_request", "Missing required parameters");
      }

      const tokens = await exchangeCodeForTokens({
        code,
        clientId,
        redirectUri,
        codeVerifier,
      });

      return Response.json(tokens);
    }

    if (grantType === "refresh_token") {
      const refreshToken = body.get("refresh_token") as string | null;
      const clientId = body.get("client_id") as string | null;

      if (!refreshToken || !clientId) {
        return oauthErrorResponse("invalid_request", "Missing required parameters");
      }

      const tokens = await refreshAccessToken({ refreshToken, clientId });
      return Response.json(tokens);
    }

    return oauthErrorResponse("unsupported_grant_type", `Unsupported grant type: ${grantType}`);
  } catch (err) {
    if (err instanceof OAuthError) {
      return oauthErrorResponse(err.code, err.message);
    }
    throw err;
  }
}

function oauthErrorResponse(error: string, description: string) {
  return Response.json(
    { error, error_description: description },
    { status: 400 },
  );
}
