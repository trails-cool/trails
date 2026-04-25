import { data } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/users.$username.followers";
import { getDb } from "~/lib/db";
import { users } from "@trails-cool/db/schema/journal";
import { listFollowers, countFollowers } from "~/lib/follow.server";
import { CollectionPage } from "~/components/CollectionPage";

export async function loader({ params, request }: Route.LoaderArgs) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.username, params.username));
  if (!user || user.profileVisibility !== "public") {
    throw data({ error: "User not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const [entries, total] = await Promise.all([
    listFollowers(user.id, page),
    countFollowers(user.id),
  ]);

  return data({
    user: { username: user.username, displayName: user.displayName },
    page,
    total,
    entries,
  });
}

export function meta({ data: d }: Route.MetaArgs) {
  return [{ title: `Followers of @${d?.user.username ?? ""} — trails.cool` }];
}

export default function Followers({ loaderData }: Route.ComponentProps) {
  return <CollectionPage kind="followers" {...loaderData} />;
}
