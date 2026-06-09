import { data } from "react-router";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/feed";
import { ClientDate } from "~/components/ClientDate";
import { ClientMap } from "~/components/ClientMap";
import { loadFeed } from "./feed.server";

export async function loader({ request }: Route.LoaderArgs) {
  return data(await loadFeed(request));
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  const view = loaderData?.view ?? "followed";
  const title = view === "public" ? "Public — trails.cool" : "Following — trails.cool";
  return [{ title }];
}

function ToggleLink({
  to,
  active,
  label,
}: {
  to: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      to={to}
      className={`-mb-px inline-flex items-center border-b-2 px-1 py-3 text-sm font-medium ${
        active
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-600 hover:text-gray-900"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Feed({ loaderData }: Route.ComponentProps) {
  const { view, activities } = loaderData;
  const { t } = useTranslation("journal");

  const heading =
    view === "public"
      ? t("social.feed.public.heading")
      : t("social.feed.heading");

  const emptyMessage =
    view === "public"
      ? t("social.feed.public.empty")
      : t("social.feed.empty");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">{heading}</h1>

      <div className="mt-4 flex gap-6 border-b border-gray-200">
        <ToggleLink
          to="/feed"
          active={view === "followed"}
          label={t("social.feed.toggle.followed")}
        />
        <ToggleLink
          to="/feed?view=public"
          active={view === "public"}
          label={t("social.feed.toggle.public")}
        />
      </div>

      {activities.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-gray-500">{emptyMessage}</p>
          {view === "followed" && (
            <Link
              to="/feed?view=public"
              className="mt-3 inline-block text-sm text-blue-600 hover:underline"
            >
              {t("social.feed.seePublic")}
            </Link>
          )}
          {view === "followed" && (
            <Link
              to="/follows/outgoing"
              className="mt-1 block text-sm text-blue-600 hover:underline"
            >
              {t("social.feed.followRemote")}
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {activities.map((a) => (
            <li key={a.id}>
              <a
                // Remote (federated) activities link to their canonical
                // page on the origin instance — there is no local detail
                // page for them.
                href={a.remote && a.externalUrl ? a.externalUrl : `/activities/${a.id}`}
                {...(a.remote ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="block rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
              >
                <div className="flex gap-4">
                  <div className="w-40 shrink-0">
                    {a.geojson ? (
                      <ClientMap geojson={a.geojson} />
                    ) : (
                      <div className="flex h-28 w-full items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                        {t("routes.noMapPreview")}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <h3 className="text-base font-medium text-gray-900">{a.name}</h3>
                      <div className="mt-1 text-sm text-gray-500">
                        {a.remote ? (
                          <span>
                            {a.ownerDisplayName ?? a.ownerUsername ?? a.ownerDomain}
                            {a.ownerUsername && a.ownerDomain && (
                              <span className="text-gray-400"> @{a.ownerUsername}@{a.ownerDomain}</span>
                            )}
                          </span>
                        ) : (
                          <a
                            href={`/users/${a.ownerUsername}`}
                            className="hover:text-gray-700 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {a.ownerDisplayName ?? a.ownerUsername}
                          </a>
                        )}
                        {" · "}
                        <ClientDate iso={a.startedAt ?? a.createdAt} />
                      </div>
                      <div className="mt-1 flex gap-4 text-sm text-gray-500">
                        {a.distance != null && (
                          <span>{(a.distance / 1000).toFixed(1)} km</span>
                        )}
                        {a.elevationGain != null && (
                          <span>↑ {Math.round(a.elevationGain)} m</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
