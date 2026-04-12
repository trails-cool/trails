import { getAuthenticatedUser } from "./oauth.server.ts";
import { ERROR_CODES } from "@trails-cool/api";

/**
 * Require authentication for an API route. Returns the user or throws a 401 Response.
 */
export async function requireApiUser(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw Response.json(
      { error: "Unauthorized", code: ERROR_CODES.UNAUTHORIZED },
      { status: 401 },
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
