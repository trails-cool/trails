import { data } from "react-router";
import type { Route } from "./+types/users.$username";
import { getDb } from "~/lib/db";
import { users } from "@trails-cool/db/schema/journal";
import { eq } from "drizzle-orm";
import { getSessionUser } from "~/lib/auth.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.username, params.username));

  if (!user) {
    throw data({ error: "User not found" }, { status: 404 });
  }

  const currentUser = await getSessionUser(request);
  const isOwn = currentUser?.id === user.id;

  return data({
    user: {
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      domain: user.domain,
      createdAt: user.createdAt.toISOString(),
    },
    isOwn,
  });
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  const username = (loaderData as { user: { username: string } })?.user?.username ?? "User";
  return [{ title: `@${username} — trails.cool` }];
}

export default function UserProfilePage({ loaderData }: Route.ComponentProps) {
  const { user, isOwn } = loaderData;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
          {user.username[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user.displayName ?? user.username}
          </h1>
          <p className="text-sm text-gray-500">
            @{user.username}@{user.domain}
          </p>
          {user.bio && <p className="mt-2 text-gray-700">{user.bio}</p>}
        </div>
      </div>

      {isOwn && (
        <div className="mt-6 flex gap-2">
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
            >
              Log out
            </button>
          </form>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Routes</h2>
        <p className="mt-2 text-sm text-gray-500">No routes yet.</p>
      </div>
    </div>
  );
}
