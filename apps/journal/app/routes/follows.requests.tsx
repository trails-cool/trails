import { data, redirect, useFetcher } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/follows.requests";
import { getSessionUser } from "~/lib/auth.server";
import { listPendingFollowRequests } from "~/lib/follow.server";
import { ClientDate } from "~/components/ClientDate";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");

  const requests = await listPendingFollowRequests(user.id);
  return data({
    requests: requests.map((r) => ({
      id: r.id,
      followerUsername: r.followerUsername,
      followerDisplayName: r.followerDisplayName,
      followerDomain: r.followerDomain,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Follow requests — trails.cool" }];
}

interface RequestRow {
  id: string;
  followerUsername: string;
  followerDisplayName: string | null;
  followerDomain: string;
  createdAt: string;
}

function RequestItem({ row }: { row: RequestRow }) {
  const { t } = useTranslation("journal");
  const approve = useFetcher();
  const reject = useFetcher();
  const inFlight = approve.state !== "idle" || reject.state !== "idle";

  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div>
        <a
          href={`/users/${row.followerUsername}`}
          className="text-sm font-medium text-gray-900 hover:underline"
        >
          {row.followerDisplayName ?? row.followerUsername}
        </a>
        <p className="text-xs text-gray-500">
          @{row.followerUsername}@{row.followerDomain} ·{" "}
          <ClientDate iso={row.createdAt} />
        </p>
      </div>
      <div className="flex gap-2">
        <reject.Form method="post" action={`/api/follows/${row.id}/reject`}>
          <button
            type="submit"
            disabled={inFlight}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("social.requests.reject")}
          </button>
        </reject.Form>
        <approve.Form method="post" action={`/api/follows/${row.id}/approve`}>
          <button
            type="submit"
            disabled={inFlight}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {t("social.requests.approve")}
          </button>
        </approve.Form>
      </div>
    </li>
  );
}

export default function FollowRequests({ loaderData }: Route.ComponentProps) {
  const { requests } = loaderData;
  const { t } = useTranslation("journal");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">{t("social.requests.title")}</h1>

      {requests.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">{t("social.requests.empty")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {requests.map((r) => (
            <RequestItem key={r.id} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
