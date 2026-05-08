// completeAuth — the single chokepoint that every successful web auth
// flow uses to mint the cookie session and produce the response. See
// ADR-0004 + CONTEXT.md (Authentication section).
//
// Two response shapes, picked via `mode`:
//   - 'redirect' (loader callers / direct browser navigation):
//       302 redirect to the sanitized target, Set-Cookie attached.
//   - 'json' (action callers from imperative fetch in client forms):
//       200 JSON { ok: true, redirectTo } with Set-Cookie. Client reads
//       redirectTo and does window.location = redirectTo.
//
// Both modes share identity-agnostic behaviour: createSession + same-
// origin sanitization + Set-Cookie. Per ADR-0005, this function knows
// nothing about how identity was proved (passkey, magic-link, etc.) —
// the caller does its own per-method verification first.
//
// Terms recording is NOT here: both registration paths (finishRegistration
// for passkey, registerWithMagicLink for magic-link) record terms at
// user-creation time, before any path can reach completeAuth.

import { redirect } from "react-router";
import { createSession } from "./session.ts";

export type CompleteAuthMode = "redirect" | "json";

export interface CompleteAuthInput {
  userId: string;
  request: Request;
  /**
   * Optional caller-supplied redirect target. Validated as a same-origin
   * path; anything else falls back to "/". Pass through whatever you
   * received from the client — sanitization is centralized here.
   */
  returnTo?: string | null;
  /**
   * Response shape:
   *   - 'redirect' (default): 302 redirect Response; right for loaders
   *     (direct browser navigation, e.g. auth.verify.tsx loader).
   *   - 'json': 200 JSON `{ ok: true, redirectTo }`; right for action
   *     handlers called by imperative fetch from client form code
   *     (e.g. api.auth.register, api.auth.login). Client navigates
   *     using `data.redirectTo`.
   */
  mode?: CompleteAuthMode;
}

/**
 * Same-origin path check. Accepts only paths that start with a single
 * "/" — rejects:
 *   - Empty / null / undefined
 *   - Protocol-relative ("//evil.com/x")
 *   - Absolute URLs ("https://evil.com")
 *   - Anything not starting with "/"
 */
function safeReturnTo(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

export async function completeAuth(input: CompleteAuthInput): Promise<Response> {
  const cookie = await createSession(input.userId, input.request);
  const target = safeReturnTo(input.returnTo) ?? "/";
  const headers = { "Set-Cookie": cookie };
  if (input.mode === "json") {
    // `step: "done"` retained for compatibility with existing client
    // form checks (auth.register.tsx, auth.login.tsx). New code should
    // read `redirectTo` and navigate there.
    return Response.json(
      { ok: true, step: "done", redirectTo: target },
      { headers },
    );
  }
  return redirect(target, { headers });
}
