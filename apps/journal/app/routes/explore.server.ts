// Server-only loader for /explore. See `home.server.ts`.

import { getSessionUser } from "~/lib/auth/session.server";
import {
  EXPLORE_DEFAULT_PAGE_SIZE,
  countFollowersBatch,
  getFollowStateBatch,
  listActiveRecently,
  listDirectory,
} from "~/lib/explore.server";
import { loadPersona } from "~/lib/demo-bot.server";

const BIO_TRUNCATE = 120;

function truncateBio(bio: string | null): string | null {
  if (!bio) return null;
  const trimmed = bio.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= BIO_TRUNCATE) return trimmed;
  return trimmed.slice(0, BIO_TRUNCATE).trimEnd() + "…";
}

export async function loadExplore(request: Request) {
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
  const personaUsername = loadPersona().username;

  const decorate = (row: typeof allRows[number]) => ({
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    bio: truncateBio(row.bio),
    followerCount: followerCounts.get(row.id) ?? 0,
    followState: followStates.get(row.id) ?? null,
    isSelf: isSelf(row.id),
    isDemoUser: row.username === personaUsername,
  });

  // Resolved page size (after loader-side clamping inside listDirectory)
  // for the pagination math here. We can compute totalPages without
  // re-querying since `directory.totalCount` is authoritative.
  const resolvedPerPage = Math.max(1, Math.min(100, Math.floor(Number.isFinite(perPage) ? perPage : EXPLORE_DEFAULT_PAGE_SIZE)));
  const resolvedPage = Math.max(1, Math.floor(Number.isFinite(page) ? page : 1));
  const totalPages = Math.max(1, Math.ceil(directory.totalCount / resolvedPerPage));

  return {
    isSignedIn: !!viewer,
    activeRecently: activeRecently.map(decorate),
    directory: directory.rows.map(decorate),
    page: resolvedPage,
    perPage: resolvedPerPage,
    totalPages,
    totalCount: directory.totalCount,
  };
}
