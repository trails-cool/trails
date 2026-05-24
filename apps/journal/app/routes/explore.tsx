import { data } from "react-router";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/explore";
import { FollowButton } from "~/components/FollowButton";
import { loadExplore } from "./explore.server";

export async function loader({ request }: Route.LoaderArgs) {
  return data(await loadExplore(request));
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Explore — trails.cool" }];
}

interface DecoratedRow {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  followerCount: number;
  followState: { following: boolean; pending: boolean } | null;
  isSelf: boolean;
  isDemoUser: boolean;
}

function DirectoryRow({ row, isSignedIn }: { row: DecoratedRow; isSignedIn: boolean }) {
  const { t } = useTranslation("journal");
  return (
    <li className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/users/${row.username}`}
            className="text-sm font-medium text-gray-900 hover:underline"
          >
            {row.displayName ?? row.username}
          </Link>
          {row.isDemoUser && (
            <span
              className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
              title={t("demo.badge")}
            >
              {t("demo.badge")}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          @{row.username} · {t("social.followers.count", { count: row.followerCount })}
        </p>
        {row.bio && <p className="mt-1 text-sm text-gray-600">{row.bio}</p>}
      </div>
      {isSignedIn && !row.isSelf && (
        <FollowButton
          username={row.username}
          isPrivateTarget={false /* directory only contains public users */}
          initialState={row.followState}
        />
      )}
    </li>
  );
}

export default function Explore({ loaderData }: Route.ComponentProps) {
  const { isSignedIn, activeRecently, directory, page, totalPages, totalCount } = loaderData;
  const { t } = useTranslation("journal");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">{t("explore.heading")}</h1>

      {activeRecently.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t("explore.activeRecently.heading")}
          </h2>
          <ul className="mt-3 rounded-lg border border-gray-200 bg-white">
            {activeRecently.map((row) => (
              <DirectoryRow key={`ar-${row.id}`} row={row} isSignedIn={isSignedIn} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {t("explore.directory.heading")}
        </h2>

        {totalCount === 0 ? (
          <p className="mt-6 text-center text-gray-500">{t("explore.empty")}</p>
        ) : (
          <>
            <ul className="mt-3 rounded-lg border border-gray-200 bg-white">
              {directory.map((row) => (
                <DirectoryRow key={row.id} row={row} isSignedIn={isSignedIn} />
              ))}
            </ul>

            <nav className="mt-4 flex items-center justify-between text-sm">
              {page > 1 ? (
                <Link
                  to={`/explore?page=${page - 1}`}
                  className="text-blue-600 hover:underline"
                >
                  ← {t("social.prevPage")}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-gray-500">
                {t("social.pageOfTotal", { page, totalPages })}
              </span>
              {page < totalPages ? (
                <Link
                  to={`/explore?page=${page + 1}`}
                  className="text-blue-600 hover:underline"
                >
                  {t("social.nextPage")} →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          </>
        )}
      </section>
    </div>
  );
}
