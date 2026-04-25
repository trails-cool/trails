import { data } from "react-router";
import type { Route } from "./+types/api.users.$username.unfollow";
import { getSessionUser } from "~/lib/auth.server";
import { unfollowUser, FollowError } from "~/lib/follow.server";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }
  const user = await getSessionUser(request);
  if (!user) return data({ error: "Unauthorized" }, { status: 401 });

  const username = params.username;
  if (!username) return data({ error: "username required" }, { status: 400 });

  try {
    const state = await unfollowUser(user.id, username);
    return data({ ok: true, ...state });
  } catch (e) {
    if (e instanceof FollowError) {
      const status = e.code === "user_not_found" ? 404 : 400;
      return data({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
