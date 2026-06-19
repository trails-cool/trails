import client from "prom-client";

// React Router's build sometimes produces two module instances of this
// file (server entry + route module graph). prom-client's registry is a
// process-wide singleton, so re-running the `new Gauge(...)` / `new
// Histogram(...)` / `collectDefaultMetrics()` calls on the second load
// throws "metric already registered". Guard everything via
// `getSingleMetric` so a second module load reuses the existing objects.

function getOrCreate<T extends client.Metric<string>>(
  name: string,
  create: () => T,
): T {
  const existing = client.register.getSingleMetric(name);
  if (existing) return existing as T;
  return create();
}

// Default process/Node metrics: registered exactly once.
if (!client.register.getSingleMetric("process_cpu_user_seconds_total")) {
  client.collectDefaultMetrics();
}

export const httpRequestDuration = getOrCreate("http_request_duration_seconds", () =>
  new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status"] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  }),
);

export const demoBotSyntheticRoutesTotal = getOrCreate(
  "demo_bot_synthetic_routes_total",
  () =>
    new client.Gauge({
      name: "demo_bot_synthetic_routes_total",
      help: "Total synthetic demo-bot routes currently stored",
    }),
);

export const demoBotSyntheticActivitiesTotal = getOrCreate(
  "demo_bot_synthetic_activities_total",
  () =>
    new client.Gauge({
      name: "demo_bot_synthetic_activities_total",
      help: "Total synthetic demo-bot activities currently stored",
    }),
);

export const registry = client.register;

// --- Route label normalization -------------------------------------------
//
// The `route` label on httpRequestDuration MUST be bounded. prom-client
// stores one label-set per distinct combination and NEVER evicts, so
// feeding it raw request paths (`/activities/<uuid>`, probed usernames,
// crawler junk) leaks memory linearly for the life of the process.
//
// We match each request path against the journal's known route templates
// (mirroring app/routes.ts) and label it with the matched template; a
// `:param` segment matches any single path segment. Anything matching no
// template — vulnerability scanners, typos, unmounted paths — collapses to
// a single `/other` bucket. Cardinality is therefore hard-bounded to
// (number of templates + 1), independent of traffic, and real routes can
// never be crowded out by scanner noise (the failure mode of the earlier
// first-come-first-served cap).
//
// IMPORTANT: ROUTE_TEMPLATES must stay in sync with app/routes.ts. The
// co-located test imports the route config, flattens it to full paths, and
// fails if the two ever drift — so adding a route there forces an update
// here.
const ROUTE_TEMPLATES: readonly string[] = [
  "/",
  "/.well-known/trails-cool",
  "/.well-known/webfinger",
  "/.well-known/nodeinfo",
  "/nodeinfo/2.1",
  "/users/:username/inbox",
  "/users/:username/outbox",
  "/oauth/authorize",
  "/oauth/token",
  "/auth/register",
  "/auth/login",
  "/auth/verify",
  "/auth/logout",
  "/auth/accept-terms",
  "/api/auth/register",
  "/api/auth/login",
  "/routes",
  "/routes/new",
  "/routes/:id",
  "/routes/:id/edit",
  "/api/e2e/seed",
  "/api/e2e/route/:id",
  "/api/e2e/komoot",
  "/api/routes/:id/callback",
  "/api/routes/:id/edit-in-planner",
  "/api/routes/:id/gpx",
  "/activities",
  "/activities/new",
  "/activities/:id",
  "/users/:username",
  "/users/:username/followers",
  "/users/:username/following",
  "/api/users/:username/follow",
  "/api/users/:username/unfollow",
  "/follows/requests",
  "/follows/outgoing",
  "/api/follows/:id/approve",
  "/api/follows/:id/reject",
  "/feed",
  "/explore",
  "/api/events",
  "/notifications",
  "/api/notifications/:id/read",
  "/api/notifications/read-all",
  "/settings",
  "/settings/profile",
  "/settings/account",
  "/settings/security",
  "/settings/connections",
  "/settings/connections/komoot",
  "/api/settings/profile",
  "/api/settings/email",
  "/api/settings/passkey/delete",
  "/api/settings/delete-account",
  "/sync/import/komoot",
  "/sync/import/garmin",
  "/sync/import/:provider",
  "/api/sync/komoot/verify",
  "/api/sync/komoot/connect",
  "/api/sync/komoot/import",
  "/api/sync/komoot/import-status",
  "/api/sync/connect/:provider",
  "/api/sync/callback/:provider",
  "/api/sync/disconnect/:provider",
  "/api/sync/webhook/:provider",
  "/api/sync/push/:provider/:routeId",
  "/privacy",
  "/legal/imprint",
  "/legal/terms",
  "/legal/privacy",
  "/api/v1/routes",
  "/api/v1/routes/compute",
  "/api/v1/routes/:id",
  "/api/v1/activities",
  "/api/v1/activities/:id",
  "/api/v1/auth/devices",
  "/api/v1/auth/devices/:id",
  "/api/v1/uploads",
];

export { ROUTE_TEMPLATES };

const isParam = (seg: string): boolean => seg.startsWith(":");

// Pre-split templates into segments, ordered most-specific first (fewest
// `:param` segments) so a literal like `/routes/new` is matched before the
// parametric `/routes/:id`.
const TEMPLATE_SEGMENTS = ROUTE_TEMPLATES.map((template) => ({
  template,
  segments: template === "/" ? [] : template.slice(1).split("/"),
})).sort(
  (a, b) =>
    a.segments.filter(isParam).length - b.segments.filter(isParam).length,
);

/** Map a request path to one of the known route templates, or `/other`. */
export function normalizeRoute(pathname: string): string {
  const path = (pathname.split("?")[0] ?? "/").split("#")[0] || "/";
  const segs = path.replace(/\/+$/, "").split("/").filter((s) => s !== "");
  if (segs.length === 0) return "/";

  for (const { template, segments } of TEMPLATE_SEGMENTS) {
    if (segments.length !== segs.length) continue;
    let matched = true;
    for (let i = 0; i < segments.length; i++) {
      const t = segments[i]!;
      if (!isParam(t) && t !== segs[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return template;
  }
  return "/other";
}
