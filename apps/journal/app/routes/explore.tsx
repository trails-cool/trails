import { data } from "react-router";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/explore";
import { getSessionUser } from "~/lib/auth.server";
import {
  EXPLORE_DEFAULT_PAGE_SIZE,
  countFollowersBatch,
  getFollowStateBatch,
  listActiveRecently,
  listDirectory,
} from "~/lib/explore.server";
import { FollowButton } from "~/components/FollowButton";

const BIO_TRUNCATE = 120;

function truncateBio(bio: string | null): string | null {
  if (!bio) return null;
  const trimmed = bio.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= BIO_TRUNCATE) return trimmed;
  return trimmed.slice(0, BIO_TRUNCATE).trimEnd() + "…";
}

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await getSessionUser(request);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const perPage = Number(url.searchParams.get("perPage") ?? String(EXPLORE_DEFAULT_PAGE_SIZE));

  const [activeRecently, directory] = await Promise.all([
    listActiveRecently(),
    listDirectory({ page, perPage }),
  ]);

  // Per-row data: follower count (for everyone) + follow state (for
  // signed-in viewers only). Both are batched so the page issues at
  // most two extra queries regardless of page size.
  const allRows = [...activeRecently, ...directory.rows];
  const allIds = allRows.map((r) => r.id);
  const followerCounts = await countFollowersBatch(allIds);
  const followStates = viewer
    ? await getFollowStateBatch(viewer.id, allRows.map((r) => ({ id: r.id, username: r.username })))
    : new Map();

  const isSelf = (rowId: string) => viewer?.id === rowId;

  const decorate = (row: typeof allRows[number]) => ({
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    bio: truncateBio(row.bio),
    followerCount: followerCounts.get(row.id) ?? 0,
    followState: followStates.get(row.id) ?? null,
    isSelf: isSelf(row.id),
  });

  // Resolved page size (after loader-side clamping inside listDirectory)
  // for the pagination math here. We can compute totalPages without
  // re-querying since `directory.totalCount` is authoritative.
  const resolvedPerPage = Math.max(1, Math.min(100, Math.floor(Number.isFinite(perPage) ? perPage : EXPLORE_DEFAULT_PAGE_SIZE)));
  const resolvedPage = Math.max(1, Math.floor(Number.isFinite(page) ? page : 1));
  const totalPages = Math.max(1, Math.ceil(directory.totalCount / resolvedPerPage));

  return data({
    isSignedIn: !!viewer,
    activeRecently: activeRecently.map(decorate),
    directory: directory.rows.map(decorate),
    page: resolvedPage,
    perPage: resolvedPerPage,
    totalPages,
    totalCount: directory.totalCount,
  });
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
}

function DirectoryRow({ row, isSignedIn }: { row: DecoratedRow; isSignedIn: boolean }) {
  const { t } = useTranslation("journal");
  return (
    <li className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <Link
          to={`/users/${row.username}`}
          className="text-sm font-medium text-gray-900 hover:underline"
        >
          {row.displayName ?? row.username}
        </Link>
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
