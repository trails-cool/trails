import { data } from "react-router";
import type { Route } from "./+types/api.notifications.$id.read";
import { getSessionUser } from "~/lib/auth.server";
import { markRead } from "~/lib/notifications.server";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }
  const user = await getSessionUser(request);
  if (!user) return data({ error: "Unauthorized" }, { status: 401 });

  const id = params.id;
  if (!id) return data({ error: "id required" }, { status: 400 });

  const ok = await markRead(user.id, id);
  if (!ok) return data({ error: "Not found" }, { status: 404 });
  return data({ ok: true });
}
