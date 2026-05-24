// Server-only loader/action for /auth/accept-terms. See `home.server.ts`.

import { data, redirect } from "react-router";
import { recordTermsAcceptance } from "~/lib/auth.server";
import { getSessionUser } from "~/lib/auth/session.server";
import { TERMS_VERSION } from "~/lib/legal";

/**
 * Paths we'll bounce back to after a successful acceptance. We only allow
 * same-origin absolute paths to avoid being used as an open redirect.
 */
function safeReturnTo(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export async function loadAcceptTerms(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    throw redirect("/auth/login");
  }
  // If the user is already current, bounce them back (e.g. double-submit).
  if (user.termsVersion === TERMS_VERSION) {
    const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
    throw redirect(returnTo);
  }
  return { previousVersion: user.termsVersion };
}

export async function acceptTermsAction(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    throw redirect("/auth/login");
  }

  const form = await request.formData();
  const accepted = form.get("termsAccepted") === "on" || form.get("termsAccepted") === "true";
  if (!accepted) {
    return data({ error: "Terms of Service must be accepted to continue" }, { status: 400 });
  }

  await recordTermsAcceptance(user.id, TERMS_VERSION);

  const returnTo = safeReturnTo(form.get("returnTo")?.toString() ?? null);
  throw redirect(returnTo);
}
