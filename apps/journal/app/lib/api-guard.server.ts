import type { z } from "zod";
import { getAuthenticatedUser } from "./oauth.server.ts";
import { TERMS_VERSION } from "./legal.ts";
import { ERROR_CODES } from "@trails-cool/api";

/**
 * Require authentication for an API route. Returns the user or throws a
 * Response: 401 if unauthenticated, 403 with `TERMS_OUTDATED` if the user's
 * stored `terms_version` is missing or stale relative to the current
 * `TERMS_VERSION`. Mirrors the cookie-session terms gate enforced by the
 * root loader, so bearer-token API traffic can't bypass it.
 */
export async function requireApiUser(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw Response.json(
      { error: "Unauthorized", code: ERROR_CODES.UNAUTHORIZED },
      { status: 401 },
    );
  }
  if (user.termsVersion !== TERMS_VERSION) {
    throw Response.json(
      {
        error: "Terms of Service have been updated and must be re-accepted",
        code: ERROR_CODES.TERMS_OUTDATED,
        currentTermsVersion: TERMS_VERSION,
      },
      { status: 403 },
    );
  }
  return user;
}

/**
 * Return a structured API error response.
 */
export function apiError(status: number, code: string, message: string, fields?: Array<{ field: string; message: string }>) {
  return Response.json({ error: message, code, fields }, { status });
}

/**
 * Respond with a payload validated against its @trails-cool/api
 * contract. The schema is enforced, not advisory: a handler whose
 * payload drifts from the contract fails its unit tests / e2e run with
 * a ZodError instead of silently shipping a different wire shape.
 * Parsing also strips unknown keys, so the response is exactly the
 * contract — nothing extra leaks.
 */
export function apiJson<S extends z.ZodType>(
  schema: S,
  payload: z.input<S>,
  init?: ResponseInit,
): Response {
  return Response.json(schema.parse(payload), init);
}
