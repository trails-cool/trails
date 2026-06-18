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
// crawler junk) leaks memory linearly for the life of the process — it
// only resets on restart. `normalizeRoute` collapses dynamic path
// segments back to the `:param` templates declared in app/routes.ts so
// cardinality stays proportional to the route table, not to traffic.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A dynamic segment is keyed by the static segment that precedes it,
// mirroring the non-id `:param` slots in app/routes.ts. (`:id` params are
// all UUIDs and get caught by UUID_RE on their own.)
const DYNAMIC_AFTER = new Map<string, string>([
  ["users", ":username"], // /users/:username, /api/users/:username/...
  ["connect", ":provider"], // /api/sync/connect/:provider
  ["callback", ":provider"], // /api/sync/callback/:provider
  ["disconnect", ":provider"], // /api/sync/disconnect/:provider
  ["webhook", ":provider"], // /api/sync/webhook/:provider
  ["push", ":provider"], // /api/sync/push/:provider/:routeId
]);

// Absolute backstop. Real route templates number well under this; once we
// have seen this many distinct normalized routes (e.g. an aggressive
// scanner hitting paths that match no `:param` rule), everything new
// collapses to a single `/other` bucket so cardinality can never run away.
const MAX_ROUTES = 200;
const seenRoutes = new Set<string>();

/** Collapse a request path's dynamic segments to a bounded route template. */
export function normalizeRoute(pathname: string): string {
  const path = (pathname.split("?")[0] ?? "/").split("#")[0] || "/";
  if (path === "/") return "/";

  const out: string[] = [];
  for (const seg of path.split("/")) {
    if (seg === "") continue;
    const prev = out.length > 0 ? out[out.length - 1]! : "";
    if (UUID_RE.test(seg) || /^\d+$/.test(seg)) {
      out.push(":id");
    } else if (DYNAMIC_AFTER.has(prev)) {
      out.push(DYNAMIC_AFTER.get(prev)!);
    } else {
      out.push(seg);
    }
  }
  const normalized = "/" + out.join("/");

  if (seenRoutes.has(normalized)) return normalized;
  if (seenRoutes.size >= MAX_ROUTES) return "/other";
  seenRoutes.add(normalized);
  return normalized;
}

/** Test-only: clear the distinct-route tracking set. */
export function _resetRouteNormalizationForTest(): void {
  seenRoutes.clear();
}
