import { redirect } from "react-router";
import type { Route } from "./+types/auth.logout";
import { destroySession } from "~/lib/auth.server";

export async function action({ request }: Route.ActionArgs) {
  const cookie = await destroySession(request);
  return redirect("/auth/login", { headers: { "Set-Cookie": cookie } });
}
