// Server-only data loader for the home route. Lives separately from
// `home.tsx` so the component file imports nothing that pulls in the DB
// client or other server-side modules at module-evaluation time. The
// route's `loader` is a thin delegator.

import { eq, count } from "drizzle-orm";
import { getSessionUser } from "~/lib/auth/session.server";
import { getDb } from "~/lib/db";
import { credentials } from "@trails-cool/db/schema/journal";
import { listActivities, listRecentPublicActivities } from "~/lib/activities.server";
import type { SportType } from "@trails-cool/db/schema/journal";

export interface HomeActivityCard {
  id: string;
  name: string;
  sportType: SportType | null;
  distance: number | null;
  elevationGain: number | null;
  duration: number | null;
  startedAt: string | null;
  createdAt: string;
  geojson: string | null;
  // Populated only for the public (logged-out) feed, where the card
  // needs to attribute the activity to an owner. Personal feed skips
  // these because it's always "you".
  ownerUsername: string | null;
  ownerDisplayName: string | null;
}

export interface HomeLoaderData {
  user: { id: string; username: string; displayName: string | null } | null;
  showAddPasskey: boolean;
  plannerUrl: string;
  isFlagship: boolean;
  activities: HomeActivityCard[];
}

export async function loadHomeData(request: Request): Promise<HomeLoaderData> {
  const user = await getSessionUser(request);
  const url = new URL(request.url);
  const addPasskeyParam = url.searchParams.get("add-passkey") === "1" && user !== null;

  let showAddPasskey = false;
  if (addPasskeyParam && user) {
    const db = getDb();
    const [row] = await db
      .select({ count: count() })
      .from(credentials)
      .where(eq(credentials.userId, user.id));
    showAddPasskey = (row?.count ?? 0) === 0;
  }

  const plannerUrl = process.env.PLANNER_URL ?? "https://planner.trails.cool";
  const isFlagship = process.env.IS_FLAGSHIP === "true";

  let activities: HomeActivityCard[];
  if (user) {
    const rows = await listActivities(user.id);
    activities = rows.slice(0, 20).map((a) => ({
      id: a.id,
      name: a.name,
      sportType: a.sportType,
      distance: a.distance,
      elevationGain: a.elevationGain,
      duration: a.duration,
      startedAt: a.startedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      geojson: a.geojson ?? null,
      ownerUsername: null,
      ownerDisplayName: null,
    }));
  } else {
    const rows = await listRecentPublicActivities(20);
    activities = rows.map((a) => ({
      id: a.id,
      name: a.name,
      sportType: a.sportType,
      distance: a.distance,
      elevationGain: a.elevationGain,
      duration: a.duration,
      startedAt: a.startedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      geojson: a.geojson ?? null,
      ownerUsername: a.ownerUsername,
      ownerDisplayName: a.ownerDisplayName,
    }));
  }

  return {
    user: user ? { id: user.id, username: user.username, displayName: user.displayName } : null,
    showAddPasskey,
    plannerUrl,
    isFlagship,
    activities,
  };
}
