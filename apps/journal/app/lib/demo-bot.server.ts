import { randomUUID } from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb } from "./db.ts";
import { activities, routes, users } from "@trails-cool/db/schema/journal";
import { setGeomFromGpx } from "./routes.server.ts";
import { TERMS_VERSION } from "./legal.ts";
import { parseGpxAsync } from "@trails-cool/gpx";
import { logger } from "./logger.server.ts";
import {
  demoBotSyntheticActivitiesTotal,
  demoBotSyntheticRoutesTotal,
} from "./metrics.server.ts";

export const DEMO_USERNAME = "bruno";
export const DEMO_DISPLAY_NAME = "Bruno";
export const DEMO_BIO =
  "Professional park inspector. Currently accepting tennis balls.";

/**
 * Inner Berlin (Tiergarten → Grunewald corridor). Keeps Bruno's walks
 * somewhere plausible for an urban dog and makes templated copy work.
 * Override with `DEMO_BOT_REGION='{"bbox":[w,s,e,n]}'`.
 */
const DEFAULT_BBOX: [number, number, number, number] = [13.25, 52.45, 13.55, 52.60];

export function isDemoBotEnabled(): boolean {
  return process.env.DEMO_BOT_ENABLED === "true";
}

export function demoRetentionDays(): number {
  const raw = process.env.DEMO_BOT_RETENTION_DAYS;
  if (!raw) return 14;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 14;
}

/**
 * Idempotent insert of the Bruno demo user. Safe to call every worker
 * boot; relies on `users.username` uniqueness to short-circuit duplicates.
 */
export async function ensureDemoUser(): Promise<string> {
  const db = getDb();
  const domain = process.env.DOMAIN ?? "localhost";

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, DEMO_USERNAME));
  if (existing) return existing.id;

  const id = randomUUID();
  await db
    .insert(users)
    .values({
      id,
      username: DEMO_USERNAME,
      email: `${DEMO_USERNAME}@${domain}`,
      displayName: DEMO_DISPLAY_NAME,
      bio: DEMO_BIO,
      domain,
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
    })
    .onConflictDoNothing({ target: users.username });

  // Re-read in case a concurrent insert won the race
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, DEMO_USERNAME));
  if (!row) throw new Error("ensureDemoUser: insert succeeded but row not found");
  return row.id;
}

export interface Region {
  bbox: [number, number, number, number];
}

export function loadRegion(): Region {
  const raw = process.env.DEMO_BOT_REGION;
  if (!raw) return { bbox: DEFAULT_BBOX };
  try {
    const parsed = JSON.parse(raw) as { bbox?: unknown };
    if (
      Array.isArray(parsed.bbox) &&
      parsed.bbox.length === 4 &&
      parsed.bbox.every((n) => typeof n === "number")
    ) {
      return { bbox: parsed.bbox as [number, number, number, number] };
    }
  } catch {
    // fall through
  }
  logger.warn({ raw }, "DEMO_BOT_REGION invalid, using default");
  return { bbox: DEFAULT_BBOX };
}

/**
 * Great-circle distance in metres between two (lon, lat) points.
 */
function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function randInBbox(bbox: [number, number, number, number]): [number, number] {
  const [w, s, e, n] = bbox;
  return [w + Math.random() * (e - w), s + Math.random() * (n - s)];
}

export interface Endpoints {
  start: [number, number];
  end: [number, number];
}

/**
 * Random start + end inside the bbox such that the crow-distance is in
 * the dog-walk band (2–12 km). Gives up after N tries; on exhaustion
 * returns whatever it has so the caller can decide (BRouter will likely
 * succeed anyway, just with shorter/longer routes).
 */
export function pickEndpoints(bbox: [number, number, number, number]): Endpoints {
  const MIN = 2_000;
  const MAX = 12_000;
  for (let i = 0; i < 50; i++) {
    const start = randInBbox(bbox);
    const end = randInBbox(bbox);
    const d = haversineMeters(start, end);
    if (d >= MIN && d <= MAX) return { start, end };
  }
  const start = randInBbox(bbox);
  const end = randInBbox(bbox);
  return { start, end };
}

// --- Bruno-voiced copy --------------------------------------------------

const NAME_POOL_EN = [
  "Grunewald north-loop patrol",
  "Tiergarten perimeter audit",
  "Tempelhof runway inspection",
  "Spree embankment survey",
  "Bruno's morning rounds",
  "Sniff-check: Kreuzberg edition",
  "Bruno found three sticks today",
  "Dog-audit report: all squirrels present",
  "Volkspark compliance walk",
  "Tennis ball reconnaissance",
  "Pretzel-crumb cleanup detail",
  "Bruno vs. the pigeons",
];

const NAME_POOL_DE = [
  "Grunewald-Nordschleife-Patrouille",
  "Tiergarten-Umfangsprüfung",
  "Tempelhof-Startbahn-Inspektion",
  "Spreeufer-Rundgang",
  "Brunos Morgenrunde",
  "Schnüffelkontrolle: Kreuzberg",
  "Bruno hat heute drei Stöcke gefunden",
  "Hundeprüfbericht: alle Eichhörnchen anwesend",
  "Volkspark-Konformitätsgang",
  "Tennisball-Aufklärung",
  "Brezel-Krümel-Aufräumdienst",
  "Bruno gegen die Tauben",
];

const DESCRIPTION_POOL_EN = [
  "Inspected several bushes. All present and accounted for.",
  "Three squirrels successfully monitored. Two got away.",
  "Good sticks: 2. Great sticks: 1. Excellent sticks: 0.",
  "Pace was brisk. Sniffs were thorough.",
  "Encountered another dog. Diplomacy established.",
  "Weather: windy. Ears: flopping.",
  "Pigeons stood their ground. A follow-up visit is required.",
  "Finished the route ahead of schedule. Extra treats expected.",
  "Investigated one suspicious paper bag. False alarm.",
  "Logged one (1) successful puddle inspection.",
];

const DESCRIPTION_POOL_DE = [
  "Mehrere Büsche inspiziert. Alle vorhanden.",
  "Drei Eichhörnchen erfolgreich beobachtet. Zwei entkommen.",
  "Gute Stöcke: 2. Großartige Stöcke: 1. Exzellente Stöcke: 0.",
  "Tempo zügig. Schnüffeln gründlich.",
  "Einen anderen Hund getroffen. Diplomatie hergestellt.",
  "Wetter: windig. Ohren: flatternd.",
  "Die Tauben hielten Stand. Ein Folgebesuch ist erforderlich.",
  "Route vor dem Zeitplan abgeschlossen. Zusätzliche Leckerlis erwartet.",
  "Eine verdächtige Papiertüte untersucht. Fehlalarm.",
  "Eine (1) erfolgreiche Pfützen-Inspektion protokolliert.",
];

function pickFrom<T>(pool: readonly T[], seed: number): T {
  const idx = Math.abs(Math.floor(seed)) % pool.length;
  return pool[idx]!;
}

/**
 * Deterministic-ish per day + per started-at minute, so same-day walks
 * don't land on the same name. Locale is chosen from the journal's
 * default — Bruno doesn't know German, but his walks come with German
 * subtitles when the reader expects them.
 */
export function templateName(startedAt: Date, locale: "en" | "de" = "en"): string {
  const pool = locale === "de" ? NAME_POOL_DE : NAME_POOL_EN;
  const seed = startedAt.getUTCDate() * 60 + startedAt.getUTCMinutes();
  return pickFrom(pool, seed);
}

export function templateDescription(
  startedAt: Date,
  locale: "en" | "de" = "en",
): string {
  const pool = locale === "de" ? DESCRIPTION_POOL_DE : DESCRIPTION_POOL_EN;
  const seed = startedAt.getUTCDate() * 137 + startedAt.getUTCSeconds() * 7;
  return pickFrom(pool, seed);
}

// --- BRouter --------------------------------------------------------------

const BROUTER_URL = process.env.BROUTER_URL ?? "http://localhost:17777";

export interface BrouterResult {
  gpx: string;
}

export type BrouterError =
  | { kind: "no-route" }
  | { kind: "timeout" }
  | { kind: "upstream-error"; status?: number };

export async function requestBrouterGpx(
  endpoints: Endpoints,
  { signal }: { signal?: AbortSignal } = {},
): Promise<BrouterResult | BrouterError> {
  const lonlats = `${endpoints.start[0]},${endpoints.start[1]}|${endpoints.end[0]},${endpoints.end[1]}`;
  const url = `${BROUTER_URL}/brouter?lonlats=${lonlats}&profile=trekking&alternativeidx=0&format=gpx`;
  try {
    const resp = await fetch(url, { signal });
    if (!resp.ok) {
      if (resp.status === 500) return { kind: "no-route" };
      return { kind: "upstream-error", status: resp.status };
    }
    const gpx = await resp.text();
    if (!gpx.includes("<trkpt")) return { kind: "no-route" };
    return { gpx };
  } catch (err) {
    if ((err as Error).name === "AbortError") return { kind: "timeout" };
    return { kind: "upstream-error" };
  }
}

// --- Generation + retention ----------------------------------------------

export interface GenerateOptions {
  now?: Date;
  /** Localise the walk name; defaults to random-ish. */
  locale?: "en" | "de";
}

/**
 * Core generate step: insert one Bruno route + activity pair. Callers
 * (the recurring job and the backfill loop) decide whether to invoke it.
 *
 * Returns the inserted route id on success, or `null` on BRouter failure
 * or DB failure. Never throws — the worker logs and moves on.
 */
export async function generateOneWalk(
  ownerId: string,
  { now = new Date(), locale = Math.random() < 0.5 ? "en" : "de" }: GenerateOptions = {},
): Promise<string | null> {
  const region = loadRegion();
  const endpoints = pickEndpoints(region.bbox);

  const result = await requestBrouterGpx(endpoints);
  if ("kind" in result) {
    logger.info({ endpoints, err: result.kind }, "demo-bot brouter miss");
    return null;
  }

  const name = templateName(now, locale);
  const description = templateDescription(now, locale);

  let distance: number;
  let elevationGain: number;
  let elevationLoss: number;
  try {
    const parsed = await parseGpxAsync(result.gpx);
    distance = parsed.distance;
    elevationGain = parsed.elevation.gain;
    elevationLoss = parsed.elevation.loss;
  } catch {
    return null;
  }

  if (!distance || distance < 500) return null;

  const db = getDb();
  const routeId = randomUUID();
  const activityId = randomUUID();

  await db.insert(routes).values({
    id: routeId,
    ownerId,
    name,
    description,
    gpx: result.gpx,
    routingProfile: "trekking",
    distance,
    elevationGain,
    elevationLoss,
    visibility: "public",
    synthetic: true,
  });
  await setGeomFromGpx(routeId, "routes", result.gpx);

  const walkingMetersPerSecond = 4.5 * 1000 / 3600; // ~4.5 km/h
  const jitter = 0.85 + Math.random() * 0.3; // ±15 %
  const durationSeconds = Math.round((distance / walkingMetersPerSecond) * jitter);

  await db.insert(activities).values({
    id: activityId,
    ownerId,
    routeId,
    name,
    description,
    gpx: result.gpx,
    startedAt: now,
    duration: durationSeconds,
    distance,
    elevationGain,
    elevationLoss,
    visibility: "public",
    synthetic: true,
  });
  await setGeomFromGpx(activityId, "activities", result.gpx);

  return routeId;
}

export async function countSyntheticRoutesRecent(days: number): Promise<number> {
  const db = getDb();
  const result = await db.execute(
    sql`SELECT count(*)::int AS count FROM journal.routes
        WHERE synthetic = true AND created_at > now() - make_interval(days => ${days})`,
  );
  const rows = result as unknown as Array<{ count: number }>;
  return rows[0]?.count ?? 0;
}

export async function countSyntheticRoutesTotal(): Promise<number> {
  const db = getDb();
  const result = await db.execute(
    sql`SELECT count(*)::int AS count FROM journal.routes WHERE synthetic = true`,
  );
  const rows = result as unknown as Array<{ count: number }>;
  return rows[0]?.count ?? 0;
}

async function countSyntheticActivitiesTotal(): Promise<number> {
  const db = getDb();
  const result = await db.execute(
    sql`SELECT count(*)::int AS count FROM journal.activities WHERE synthetic = true`,
  );
  const rows = result as unknown as Array<{ count: number }>;
  return rows[0]?.count ?? 0;
}

/**
 * Refresh the prometheus gauges. Called by the job handlers so the
 * worker process exposes fresh counts at scrape time without needing a
 * periodic poller.
 */
export async function refreshDemoBotGauges(): Promise<void> {
  const [routesCount, activitiesCount] = await Promise.all([
    countSyntheticRoutesTotal(),
    countSyntheticActivitiesTotal(),
  ]);
  demoBotSyntheticRoutesTotal.set(routesCount);
  demoBotSyntheticActivitiesTotal.set(activitiesCount);
}

/**
 * Delete synthetic routes + activities older than `days`. Never touches
 * non-synthetic rows.
 */
export async function pruneSynthetic(days: number): Promise<{ routes: number; activities: number }> {
  const db = getDb();
  const cutoff = sql`now() - make_interval(days => ${days})`;

  const actDeleted = await db
    .delete(activities)
    .where(and(eq(activities.synthetic, true), lt(activities.createdAt, cutoff)))
    .returning({ id: activities.id });

  const routeDeleted = await db
    .delete(routes)
    .where(and(eq(routes.synthetic, true), lt(routes.createdAt, cutoff)))
    .returning({ id: routes.id });

  return { routes: routeDeleted.length, activities: actDeleted.length };
}

/**
 * Compute the local hour in Europe/Berlin without pulling in a tz library —
 * we only need to gate the decide-to-walk window, which is quite tolerant
 * to DST drift.
 */
export function berlinHour(now: Date): number {
  const s = now.toLocaleString("en-US", {
    timeZone: "Europe/Berlin",
    hour12: false,
    hour: "2-digit",
  });
  return Number.parseInt(s, 10);
}

/**
 * The decide-to-walk gate: only within 07–21 local, Bernoulli p=0.12.
 * Factored out so tests can replace `Math.random` / `now`.
 */
export function shouldWalkNow(now: Date, rand: () => number = Math.random): boolean {
  const hour = berlinHour(now);
  if (hour < 7 || hour >= 21) return false;
  return rand() < 0.12;
}

export const DEMO_DAILY_CAP = 40;
export const DEMO_BACKFILL_TARGET = 4;
