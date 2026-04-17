import { data } from "react-router";
import type { Route } from "./+types/api.auth.register";
import { startRegistration, finishRegistration, createSession, addPasskeyStart, addPasskeyFinish, registerWithMagicLink } from "~/lib/auth.server";
import { sendWelcome, sendMagicLink } from "~/lib/email.server";
import { logger } from "~/lib/logger.server";

export async function action({ request }: Route.ActionArgs) {
  const body = await request.json();
  const { step, email, username, response, challenge, userId, termsAccepted } = body;
  const origin = process.env.ORIGIN ?? `http://localhost:3000`;

  // Registration steps require terms acceptance
  const requiresTerms = step === "start" || step === "finish" || step === "register-magic-link";
  if (requiresTerms && !termsAccepted) {
    return data({ error: "Terms of Service must be accepted" }, { status: 400 });
  }

  try {
    if (step === "start") {
      const result = await startRegistration(email, username);
      return data({ step: "challenge", options: result.options, userId: result.userId });
    }

    if (step === "finish") {
      const newUserId = await finishRegistration(userId, email, username, response, challenge);
      const cookie = await createSession(newUserId, request);
      sendWelcome(email, username).catch((err) =>
        logger.error({ err }, "Failed to send welcome email"),
      );
      return data({ step: "done" }, { headers: { "Set-Cookie": cookie } });
    }

    if (step === "register-magic-link") {
      const token = await registerWithMagicLink(email, username);
      const link = `${origin}/auth/verify?token=${token}`;
      if (process.env.NODE_ENV !== "production") {
        return data({ step: "magic-link-sent", devLink: link });
      }
      await sendMagicLink(email, link);
      sendWelcome(email, username).catch((err) =>
        logger.error({ err }, "Failed to send welcome email"),
      );
      return data({ step: "magic-link-sent" });
    }

    if (step === "add-passkey") {
      const options = await addPasskeyStart(userId);
      return data({ step: "challenge", options });
    }

    if (step === "finish-add-passkey") {
      await addPasskeyFinish(userId, response, challenge);
      return data({ step: "done" });
    }

    return data({ error: "Invalid step" }, { status: 400 });
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 400 });
  }
}
