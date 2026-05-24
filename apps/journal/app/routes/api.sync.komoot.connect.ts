// POST /api/sync/komoot/connect
// Validates Komoot email/password credentials and stores them encrypted.

import { data } from "react-router";
import type { Route } from "./+types/api.sync.komoot.connect";
import { requireSessionUser } from "~/lib/auth/session.server";
import { loginKomoot } from "~/lib/komoot.server";
import { encrypt } from "~/lib/crypto.server";
import { link } from "~/lib/connected-services/manager";

export async function action({ request }: Route.ActionArgs) {
  const user = await requireSessionUser(request);

  const body = (await request.json()) as { email?: string; password?: string };
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return data({ error: "missing_fields" }, { status: 400 });
  }

  let username: string;
  try {
    const result = await loginKomoot(email, password);
    username = result.username;
  } catch {
    return data({ error: "invalid_credentials" }, { status: 401 });
  }

  const encryptedPassword = encrypt(password);

  await link({
    userId: user.id,
    provider: "komoot",
    credentialKind: "web-login",
    credentials: {
      mode: "authenticated",
      email,
      encryptedPassword,
      komootUserId: username,
    },
    providerUserId: username,
    grantedScopes: [],
  });

  return data({ success: true });
}
