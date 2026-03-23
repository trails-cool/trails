import { data } from "react-router";
import type { Route } from "./+types/api.auth.login";
import { startAuthentication, finishAuthentication, createMagicToken, createSession } from "~/lib/auth.server";

export async function action({ request }: Route.ActionArgs) {
  const body = await request.json();
  const { step, response, challenge, email } = body;

  try {
    if (step === "start-passkey") {
      const options = await startAuthentication();
      return data({ step: "challenge", options });
    }

    if (step === "finish-passkey") {
      const userId = await finishAuthentication(response, challenge);
      const cookie = await createSession(userId, request);
      return data({ step: "done" }, { headers: { "Set-Cookie": cookie } });
    }

    if (step === "magic-link") {
      const token = await createMagicToken(email);
      const origin = process.env.ORIGIN ?? "http://localhost:3000";
      const link = `${origin}/auth/verify?token=${token}`;
      console.log(`[Magic Link] ${email}: ${link}`);

      // In dev, return the link directly so the client can auto-redirect
      if (process.env.NODE_ENV !== "production") {
        return data({ step: "magic-link-sent", devLink: link });
      }
      return data({ step: "magic-link-sent" });
    }

    return data({ error: "Invalid step" }, { status: 400 });
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 400 });
  }
}
