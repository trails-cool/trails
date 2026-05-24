import { data } from "react-router";
import type { Route } from "./+types/users.$username.followers";
import { CollectionPage } from "~/components/CollectionPage";
import { loadUserFollowers } from "./users.$username.followers.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  return data(await loadUserFollowers(request, params.username));
}

export function meta({ data: d }: Route.MetaArgs) {
  return [{ title: `Followers of @${d?.user.username ?? ""} — trails.cool` }];
}

export default function Followers({ loaderData }: Route.ComponentProps) {
  return <CollectionPage kind="followers" {...loaderData} />;
}
