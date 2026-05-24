import { data } from "react-router";
import { z } from "zod";
import { getOrigin } from "~/lib/config.server";
import type { Route } from "./+types/api.auth.register";
import { startRegistration, finishRegistration, addPasskeyStart, addPasskeyFinish, registerWithMagicLink } from "~/lib/auth.server";
import { completeAuth } from "~/lib/auth/completion.server";
import { sendMagicLink } from "~/lib/email.server";
import { enqueueOptional } from "~/lib/boss.server";

// Permissive schema: the discriminator (`step`) and primitive fields are
// validated strictly; nested WebAuthn payloads stay as unknown because their
// shape is enforced downstream by @simplewebauthn.
const registerBodySchema = z.object({
  step: z.enum([
    "start",
    "finish",
    "register-magic-link",
    "add-passkey",
    "finish-add-passkey",
  ]),
  email: z.string().email().max(320).optional(),
  username: z.string().min(1).max(64).optional(),
  userId: z.string().min(1).max(128).optional(),
  response: z.unknown().optional(),
  challenge: z.string().max(4096).optional(),
  termsAccepted: z.boolean().optional(),
  termsVersion: z.string().max(64).optional(),
  returnTo: z.string().max(2048).optional(),
});

export async function action({ request }: Route.ActionArgs) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return data({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = registerBodySchema.safeParse(raw);
  if (!parsed.success) {
    return data({ error: "Invalid request body" }, { status: 400 });
  }
  const { step, email, username, response, challenge, userId, termsAccepted, termsVersion, returnTo } = parsed.data;
  const origin = getOrigin();

  // Registration steps require terms acceptance + the version the client
  // agreed to (stored for audit so we can tell which text the user saw).
  const requiresTerms = step === "start" || step === "finish" || step === "register-magic-link";
  if (requiresTerms && !termsAccepted) {
    return data({ error: "Terms of Service must be accepted" }, { status: 400 });
  }
  if (requiresTerms && (typeof termsVersion !== "string" || termsVersion.length === 0)) {
    return data({ error: "Terms of Service version missing" }, { status: 400 });
  }

  function requireString(v: string | undefined, name: string): string {
    if (typeof v !== "string" || v.length === 0) {
      throw new Error(`Missing required field: ${name}`);
    }
    return v;
  }

  try {
    if (step === "start") {
      const result = await startRegistration(
        requireString(email, "email"),
        requireString(username, "username"),
      );
      return data({ step: "challenge", options: result.options, userId: result.userId });
    }

    if (step === "finish") {
      const emailStr = requireString(email, "email");
      const usernameStr = requireString(username, "username");
      const newUserId = await finishRegistration(
        requireString(userId, "userId"),
        emailStr,
        usernameStr,
        // Validated downstream by @simplewebauthn.
        response as Parameters<typeof finishRegistration>[3],
        requireString(challenge, "challenge"),
        requireString(termsVersion, "termsVersion"),
      );
      await enqueueOptional(
        "send-welcome-email",
        { email: emailStr, username: usernameStr },
        { source: "register" },
      );
      return completeAuth({ userId: newUserId, request, returnTo, mode: "json" });
    }

    if (step === "register-magic-link") {
      const emailStr = requireString(email, "email");
      const usernameStr = requireString(username, "username");
      const { token, code } = await registerWithMagicLink(
        emailStr,
        usernameStr,
        requireString(termsVersion, "termsVersion"),
      );
      const link = `${origin}/auth/verify?token=${token}`;
      if (process.env.NODE_ENV !== "production") {
        // Mirror the login endpoint so devs can grab either the link or
        // the 6-digit code straight from the terminal.
        console.log(`[Register Magic Link] ${emailStr}: ${link} (code: ${code})`);
        return data({ step: "magic-link-sent", devLink: link, code });
      }
      await sendMagicLink(emailStr, link, code);
      await enqueueOptional(
        "send-welcome-email",
        { email: emailStr, username: usernameStr },
        { source: "register" },
      );
      return data({ step: "magic-link-sent" });
    }

    if (step === "add-passkey") {
      const options = await addPasskeyStart(requireString(userId, "userId"));
      return data({ step: "challenge", options });
    }

    if (step === "finish-add-passkey") {
      await addPasskeyFinish(
        requireString(userId, "userId"),
        response as Parameters<typeof addPasskeyFinish>[1],
        requireString(challenge, "challenge"),
      );
      return data({ step: "done" });
    }

    return data({ error: "Invalid step" }, { status: 400 });
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 400 });
  }
}
