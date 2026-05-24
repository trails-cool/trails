// Server-only loader for /auth/verify. See `home.server.ts` for the pattern.

import { redirect, data } from "react-router";
import { verifyMagicToken, verifyEmailChange } from "~/lib/auth.server";
import { requireSessionUser } from "~/lib/auth/session.server";
import { completeAuth } from "~/lib/auth/completion.server";

export async function loadAuthVerify(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const isEmailChange = url.searchParams.get("email-change") === "1";

  if (!token) {
    return data({ error: "Missing token" }, { status: 400 });
  }

  try {
    if (isEmailChange) {
      const user = await requireSessionUser(request);
      await verifyEmailChange(token, user.id);
      return redirect("/settings/account");
    }

    const userId = await verifyMagicToken(token);
    // Default destination after magic-link sign-in is "/?add-passkey=1"
    // (prompt to set up a passkey now that they're in). If the link
    // carried a returnTo, completeAuth's safeReturnTo will honor any
    // same-origin path and otherwise fall back to "/" — handle the
    // add-passkey default before delegating.
    const returnTo = url.searchParams.get("returnTo") ?? "/?add-passkey=1";
    return completeAuth({ userId, request, returnTo, mode: "redirect" });
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 400 });
  }
}
