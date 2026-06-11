import { data } from "react-router";
import { getOrigin } from "~/lib/config.server";
import type { Route } from "./+types/api.auth.login";
import { startAuthentication, finishAuthentication, createMagicToken, verifyLoginCode } from "~/lib/auth.server";
import { completeAuth } from "~/lib/auth/completion.server";
import { sendMagicLink } from "~/lib/email.server";
import { consumeRateLimit, clientIp } from "~/lib/rate-limit.server";

function tooManyRequests(resetMs: number) {
  return data(
    { error: `Too many attempts. Try again in ${Math.ceil(resetMs / 1000)}s.` },
    { status: 429, headers: { "Retry-After": String(Math.ceil(resetMs / 1000)) } },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const body = await request.json();
  const { step, response, challenge, email, code, returnTo } = body;
  const ip = clientIp(request);

  // Per-IP cap on every auth attempt regardless of step — defends
  // against a single attacker fan-out across step types.
  const ipLimit = consumeRateLimit({
    scope: "auth-attempt-ip",
    key: ip,
    limit: 30,
    windowMs: 60_000,
  });
  if (!ipLimit.allowed) return tooManyRequests(ipLimit.resetMs);

  try {
    if (step === "start-passkey") {
      const options = await startAuthentication();
      return data({ step: "challenge", options });
    }

    if (step === "finish-passkey") {
      // Tighter per-IP cap on credential-consuming steps — passkey
      // assertions don't usefully retry that fast.
      const verify = consumeRateLimit({
        scope: "passkey-verify",
        key: ip,
        limit: 10,
        windowMs: 60_000,
      });
      if (!verify.allowed) return tooManyRequests(verify.resetMs);
      const userId = await finishAuthentication(response, challenge);
      return completeAuth({ userId, request, returnTo, mode: "json" });
    }

    if (step === "magic-link") {
      // Cap magic-link generation per email so an attacker can't spam a
      // victim's inbox with codes, and per IP so a single client can't
      // fan out across many addresses.
      if (typeof email === "string" && email.length > 0) {
        const perEmail = consumeRateLimit({
          scope: "magic-link-email",
          key: email.toLowerCase(),
          limit: 3,
          windowMs: 5 * 60_000,
        });
        if (!perEmail.allowed) return tooManyRequests(perEmail.resetMs);
      }
      const perIp = consumeRateLimit({
        scope: "magic-link-ip",
        key: ip,
        limit: 10,
        windowMs: 5 * 60_000,
      });
      if (!perIp.allowed) return tooManyRequests(perIp.resetMs);

      // Always respond "sent" regardless of whether the account exists,
      // so the response can't probe which emails are registered. A token
      // is only minted (and mail only sent) for a real account.
      const minted = await createMagicToken(email);
      if (minted) {
        const origin = getOrigin();
        const link = `${origin}/auth/verify?token=${minted.token}`;
        // In dev, return the link and code directly for a real account.
        if (process.env.NODE_ENV !== "production") {
          console.log(`[Magic Link] ${email}: ${link} (code: ${minted.code})`);
          return data({ step: "magic-link-sent", devLink: link, code: minted.code });
        }
        await sendMagicLink(email, link, minted.code);
      }
      return data({ step: "magic-link-sent" });
    }

    if (step === "verify-code") {
      if (!email || !code) {
        return data({ error: "Email and code are required" }, { status: 400 });
      }
      // Per-email cap to defeat 6-digit code brute force — 10 attempts
      // per 15 minutes gives legitimate users plenty of room while making
      // a brute-force search (~10^6 codes) infeasible before the code
      // expires.
      const codeLimit = consumeRateLimit({
        scope: "verify-code",
        key: String(email).toLowerCase(),
        limit: 10,
        windowMs: 15 * 60_000,
      });
      if (!codeLimit.allowed) return tooManyRequests(codeLimit.resetMs);
      const userId = await verifyLoginCode(email, code);
      return completeAuth({ userId, request, returnTo, mode: "json" });
    }

    return data({ error: "Invalid step" }, { status: 400 });
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 400 });
  }
}
