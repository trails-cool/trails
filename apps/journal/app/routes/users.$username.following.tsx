import { data } from "react-router";
import type { Route } from "./+types/users.$username.following";
import { CollectionPage } from "~/components/CollectionPage";
import { loadUserFollowing } from "./users.$username.following.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  return data(await loadUserFollowing(request, params.username));
}

export function meta({ data: d }: Route.MetaArgs) {
  return [{ title: `Following of @${d?.user.username ?? ""} — trails.cool` }];
}

export default function Following({ loaderData }: Route.ComponentProps) {
  return <CollectionPage kind="following" {...loaderData} />;
}
