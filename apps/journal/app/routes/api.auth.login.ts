import { data } from "react-router";
import { getOrigin } from "~/lib/config.server";
import type { Route } from "./+types/api.auth.login";
import { startAuthentication, finishAuthentication, createMagicToken, verifyLoginCode } from "~/lib/auth.server";
import { completeAuth } from "~/lib/auth/completion.server";
import { sendMagicLink } from "~/lib/email.server";

export async function action({ request }: Route.ActionArgs) {
  const body = await request.json();
  const { step, response, challenge, email, code, returnTo } = body;

  try {
    if (step === "start-passkey") {
      const options = await startAuthentication();
      return data({ step: "challenge", options });
    }

    if (step === "finish-passkey") {
      const userId = await finishAuthentication(response, challenge);
      return completeAuth({ userId, request, returnTo, mode: "json" });
    }

    if (step === "magic-link") {
      const { token, code: loginCode } = await createMagicToken(email);
      const origin = getOrigin();
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
      return completeAuth({ userId, request, returnTo, mode: "json" });
    }

    return data({ error: "Invalid step" }, { status: 400 });
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 400 });
  }
}
