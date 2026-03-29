import { data, redirect } from "react-router";
import type { Route } from "./+types/api.settings.email";
import { getSessionUser, initiateEmailChange } from "~/lib/auth.server";
import { sendMagicLink } from "~/lib/email.server";

export async function action({ request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");

  const formData = await request.formData();
  const newEmail = (formData.get("newEmail") as string)?.trim();
  if (!newEmail) return data({ error: "Email is required" }, { status: 400 });

  const origin = process.env.ORIGIN ?? "http://localhost:3000";

  try {
    const token = await initiateEmailChange(user.id, newEmail);
    const link = `${origin}/auth/verify?token=${token}&email-change=1`;

    if (process.env.NODE_ENV !== "production") {
      return data({ ok: true, devLink: link });
    }

    await sendMagicLink(newEmail, link);
    return data({ ok: true });
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 400 });
  }
}
