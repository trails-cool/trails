import { data } from "react-router";
import type { Route } from "./+types/api.auth.register";
import { startRegistration, finishRegistration, createSession, addPasskeyStart, addPasskeyFinish } from "~/lib/auth.server";
import { sendWelcome } from "~/lib/email.server";
import { logger } from "~/lib/logger.server";

export async function action({ request }: Route.ActionArgs) {
  const body = await request.json();
  const { step, email, username, response, challenge, userId } = body;

  try {
    if (step === "start") {
      const result = await startRegistration(email, username);
      return data({ step: "challenge", options: result.options, userId: result.userId });
    }

    if (step === "finish") {
      const newUserId = await finishRegistration(userId, email, username, response, challenge);
      const cookie = await createSession(newUserId, request);
      // Send welcome email (fire-and-forget — don't block registration on email)
      sendWelcome(email, username).catch((err) =>
        logger.error({ err }, "Failed to send welcome email"),
      );
      return data({ step: "done" }, { headers: { "Set-Cookie": cookie } });
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
