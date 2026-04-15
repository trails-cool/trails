import { data } from "react-router";
import type { Route } from "./+types/api.auth.login";
import { startAuthentication, finishAuthentication, createMagicToken, verifyLoginCode, createSession } from "~/lib/auth.server";
import { sendMagicLink } from "~/lib/email.server";

export async function action({ request }: Route.ActionArgs) {
  const body = await request.json();
  const { step, response, challenge, email, code } = body;

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
      const { token, code: loginCode } = await createMagicToken(email);
      const origin = process.env.ORIGIN ?? "http://localhost:3000";
      const link = `${origin}/auth/verify?token=${token}`;
      // In dev, return the link and code directly
      if (process.env.NODE_ENV !== "production") {
        console.log(`[Magic Link] ${email}: ${link} (code: ${loginCode})`);
        return data({ step: "magic-link-sent", devLink: link, code: loginCode });
      }

      await sendMagicLink(email, link, loginCode);
      return data({ step: "magic-link-sent" });
    }

    if (step === "verify-code") {
      if (!email || !code) {
        return data({ error: "Email and code are required" }, { status: 400 });
      }
      const userId = await verifyLoginCode(email, code);
      const cookie = await createSession(userId, request);
      return data({ step: "done" }, { headers: { "Set-Cookie": cookie } });
    }

    return data({ error: "Invalid step" }, { status: 400 });
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 400 });
  }
}
