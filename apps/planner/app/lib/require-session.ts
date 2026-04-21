import { getSession, type SessionMetadata } from "./sessions.ts";

/**
 * Gate a proxy endpoint on the presence of a valid planner session.
 * Returns the session row if `id` names an open session, or a 401
 * Response for the caller to return otherwise. Callers:
 *
 *   const session = await requireSession(sessionId);
 *   if (session instanceof Response) return session;
 *
 * The session timeout is handled by the `expire-sessions` cron; a
 * missing or closed row is treated the same way here.
 */
export async function requireSession(
  id: string | null | undefined,
): Promise<SessionMetadata | Response> {
  if (!id || typeof id !== "string") {
    return new Response("Missing session", { status: 401 });
  }
  const session = await getSession(id);
  if (!session) {
    return new Response("Unknown or closed session", { status: 401 });
  }
  return session;
}
