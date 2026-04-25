import { data } from "react-router";
import type { Route } from "./+types/api.notifications.read-all";
import { getSessionUser } from "~/lib/auth.server";
import { markAllRead } from "~/lib/notifications.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }
  const user = await getSessionUser(request);
  if (!user) return data({ error: "Unauthorized" }, { status: 401 });

  const updated = await markAllRead(user.id);
  return data({ ok: true, updated });
}
