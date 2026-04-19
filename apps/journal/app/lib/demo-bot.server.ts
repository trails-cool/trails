import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
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

// --- Persona configuration -----------------------------------------------

export type DemoLocale = "en" | "de";

export interface DemoPersonaContent {
  names: { en?: string[]; de?: string[] };
  descriptions: { en?: string[]; de?: string[] };
}

export interface DemoPersona {
  username: string;
  displayName: string;
  bio: string;
  locales: DemoLocale[];
  content: DemoPersonaContent;
}

const LocaleSchema = z.enum(["en", "de"]);
const PoolSchema = z.array(z.string().min(1)).min(3).max(50);

const PersonaSchema = z
  .object({
    username: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,30}$/),
    displayName: z.string().min(1).max(200),
    bio: z.string().max(200),
    locales: z.array(LocaleSchema).min(1),
    content: z.object({
      names: z.object({ en: PoolSchema.optional(), de: PoolSchema.optional() }),
      descriptions: z.object({
        en: PoolSchema.optional(),
        de: PoolSchema.optional(),
      }),
    }),
  })
  .superRefine((p, ctx) => {
    for (const loc of p.locales) {
      if (!p.content.names[loc]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["content", "names", loc],
          message: `missing name pool for declared locale '${loc}'`,
        });
      }
      if (!p.content.descriptions[loc]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["content", "descriptions", loc],
          message: `missing description pool for declared locale '${loc}'`,
        });
      }
    }
  });

/**
 * Built-in Bruno persona. Used verbatim when no `DEMO_BOT_PERSONA` is
 * supplied or the supplied override fails validation. Moving these
 * strings behind the persona abstraction means every reference to the
 * bot's identity flows through one place.
 */
export const DEFAULT_PERSONA: DemoPersona = Object.freeze<DemoPersona>({
  username: "bruno",
  displayName: "Bruno",
  bio: "Professional park inspector. Currently accepting tennis balls.",
  locales: ["en", "de"],
  content: {
    names: {
      en: [
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
      ],
      de: [
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
      ],
    },
    descriptions: {
      en: [
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
      ],
      de: [
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
      ],
    },
  },
});

// Sanity: the default persona itself must parse under the schema. Catch
// accidental drift at module load rather than first invocation.
PersonaSchema.parse(DEFAULT_PERSONA);

let _cachedPersona: DemoPersona | null = null;

/**
 * Read the persona from `DEMO_BOT_PERSONA`. Accepts either inline JSON
 * or `file:<absolute-path>`. Falls back to `DEFAULT_PERSONA` on any
 * failure (unset, bad JSON, schema violation, unreadable file) with a
 * single warn-level log line per process.
 */
export function loadPersona(): DemoPersona {
  if (_cachedPersona) return _cachedPersona;
  _cachedPersona = Object.freeze(loadPersonaUncached());
  return _cachedPersona;
}

function loadPersonaUncached(): DemoPersona {
  const raw = process.env.DEMO_BOT_PERSONA;
  if (!raw) return DEFAULT_PERSONA;

  let json: string;
  if (raw.startsWith("file:")) {
    const path = raw.slice("file:".length);
    try {
      json = readFileSync(path, "utf8");
    } catch (err) {
      logger.warn(
        { path, err: (err as Error).message },
        "DEMO_BOT_PERSONA file unreadable, using default",
      );
      return DEFAULT_PERSONA;
    }
  } else {
    json = raw;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "DEMO_BOT_PERSONA not valid JSON, using default",
    );
    return DEFAULT_PERSONA;
  }

  const result = PersonaSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    logger.warn(
      { path: first?.path.join("."), message: first?.message },
      "DEMO_BOT_PERSONA schema violation, using default",
    );
    return DEFAULT_PERSONA;
  }
  return result.data;
}

/**
 * Test-only hook to reset the cached persona between tests. Never call
 * from application code.
 */
export function __resetPersonaCacheForTests() {
  _cachedPersona = null;
}

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
 * Surfaced when the persona username already belongs to a real user.
 * Callers (worker boot) treat this as a signal to skip scheduling the
 * bot for this process instead of silently attaching to a human's
 * account.
 */
export class DemoPersonaUsernameClashError extends Error {
  readonly kind = "username-clash";
  readonly username: string;
  constructor(username: string) {
    super(`demo persona username '${username}' is already taken by a non-demo user`);
    this.username = username;
  }
}

function expectedSentinelEmail(persona: DemoPersona, domain: string): string {
  return `${persona.username}@${domain}`;
}

/**
 * Idempotent insert of the demo user described by `persona`. Safe to
 * call every worker boot; relies on `users.username` uniqueness to
 * short-circuit duplicates. Throws `DemoPersonaUsernameClashError` if
 * the row exists but looks like a real account (email doesn't match
 * the sentinel pattern) — callers should catch this and keep the bot
 * disabled for the process.
 */
export async function ensureDemoUser(
  persona: DemoPersona = loadPersona(),
): Promise<string> {
  const db = getDb();
  const domain = process.env.DOMAIN ?? "localhost";
  const sentinelEmail = expectedSentinelEmail(persona, domain);

  const [existing] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.username, persona.username));
  if (existing) {
    if (existing.email !== sentinelEmail) {
      throw new DemoPersonaUsernameClashError(persona.username);
    }
    return existing.id;
  }

  const id = randomUUID();
  await db
    .insert(users)
    .values({
      id,
      username: persona.username,
      email: sentinelEmail,
      displayName: persona.displayName,
      bio: persona.bio,
      domain,
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
    })
    .onConflictDoNothing({ target: users.username });

  // Re-read in case a concurrent insert won the race
  const [row] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.username, persona.username));
  if (!row) throw new Error("ensureDemoUser: insert succeeded but row not found");
  if (row.email !== sentinelEmail) {
    throw new DemoPersonaUsernameClashError(persona.username);
  }
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

// --- Persona-driven copy -------------------------------------------------

function pickFrom<T>(pool: readonly T[], seed: number): T {
  const idx = Math.abs(Math.floor(seed)) % pool.length;
  return pool[idx]!;
}

/**
 * Pull a route name from the persona's name pool for the given locale.
 * Seeded by the start-time so same-day walks usually don't collide.
 * Falls back to the first persona locale if the caller asked for a
 * locale the persona doesn't support (defensive — the caller is
 * expected to pick from `persona.locales`).
 */
export function templateName(
  startedAt: Date,
  locale: DemoLocale,
  persona: DemoPersona = loadPersona(),
): string {
  const pool = persona.content.names[locale] ?? persona.content.names[persona.locales[0]!]!;
  const seed = startedAt.getUTCDate() * 60 + startedAt.getUTCMinutes();
  return pickFrom(pool, seed);
}

export function templateDescription(
  startedAt: Date,
  locale: DemoLocale,
  persona: DemoPersona = loadPersona(),
): string {
  const pool =
    persona.content.descriptions[locale] ??
    persona.content.descriptions[persona.locales[0]!]!;
  const seed = startedAt.getUTCDate() * 137 + startedAt.getUTCSeconds() * 7;
  return pickFrom(pool, seed);
}

/**
 * Random locale from the persona's supported set. Used by the
 * generation job so instances with `locales: ["en"]` never emit
 * German-voiced walks.
 */
export function pickLocale(
  persona: DemoPersona = loadPersona(),
  rand: () => number = Math.random,
): DemoLocale {
  return persona.locales[Math.floor(rand() * persona.locales.length)]!;
}

// --- Route compute via the planner ---------------------------------------

/**
 * The journal goes through the planner (not BRouter directly) because
 * the planner is the BRouter client in this architecture — route
 * compute, rate limiting, and the eventual move of BRouter off-box
 * all live there. Same `PLANNER_URL` the interactive handoff routes
 * use; falls back to the dev port in local work.
 */
const PLANNER_URL = process.env.PLANNER_URL ?? "http://localhost:3001";

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
  const url = `${PLANNER_URL}/api/route`;
  const body = {
    waypoints: [
      { lon: endpoints.start[0], lat: endpoints.start[1] },
      { lon: endpoints.end[0], lat: endpoints.end[1] },
    ],
    profile: "trekking",
    format: "gpx" as const,
  };
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!resp.ok) {
      // Planner returns 422 for BRouter client errors (unroutable
      // waypoints) and 5xx for upstream/planner failures.
      if (resp.status === 422) return { kind: "no-route" };
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
  /** Override the locale; defaults to a random one from the persona. */
  locale?: DemoLocale;
  /** Test-only: inject a persona instead of reading the env. */
  persona?: DemoPersona;
}

/**
 * Core generate step: insert one demo route + activity pair. Callers
 * (the recurring job and the backfill loop) decide whether to invoke it.
 *
 * Returns the inserted route id on success, or `null` on BRouter failure
 * or DB failure. Never throws — the worker logs and moves on.
 */
export async function generateOneWalk(
  ownerId: string,
  {
    now = new Date(),
    persona = loadPersona(),
    locale = pickLocale(persona),
  }: GenerateOptions = {},
): Promise<string | null> {
  const region = loadRegion();
  const endpoints = pickEndpoints(region.bbox);

  const result = await requestBrouterGpx(endpoints);
  if ("kind" in result) {
    logger.info({ endpoints, err: result.kind }, "demo-bot brouter miss");
    return null;
  }

  const name = templateName(now, locale, persona);
  const description = templateDescription(now, locale, persona);

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
 * The decide-to-walk gate: only within 07–21 local, Bernoulli p=0.09.
 * Factored out so tests can replace `Math.random` / `now`.
 *
 * Cadence math: the job ticks every 30 min, so the 14-hour daytime
 * window (07:00–21:00 Berlin) covers 28 ticks/day. With p=0.09 the
 * expected walks/day ≈ 28 * 0.09 ≈ 2.52, which lands in the target
 * 2–3 walks/day band.
 */
export function shouldWalkNow(now: Date, rand: () => number = Math.random): boolean {
  const hour = berlinHour(now);
  if (hour < 7 || hour >= 21) return false;
  return rand() < 0.09;
}

export const DEMO_DAILY_CAP = 40;
export const DEMO_BACKFILL_TARGET = 4;
