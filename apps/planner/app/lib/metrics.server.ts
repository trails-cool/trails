import client from "prom-client";

// Guard all metric registration — Vite's dev server can re-evaluate
// this module, causing "already registered" errors.
function getOrCreate<T>(name: string, create: () => T): T {
  return (client.register.getSingleMetric(name) as T) ?? create();
}

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

export const plannerActiveSessions = getOrCreate("planner_active_sessions", () =>
  new client.Gauge({
    name: "planner_active_sessions",
    help: "Number of active planner sessions",
  }),
);

export const plannerConnectedClients = getOrCreate("planner_connected_clients", () =>
  new client.Gauge({
    name: "planner_connected_clients",
    help: "Number of connected WebSocket clients",
  }),
);

export const brouterRequestDuration = getOrCreate("brouter_request_duration_seconds", () =>
  new client.Histogram({
    name: "brouter_request_duration_seconds",
    help: "Duration of BRouter API requests in seconds",
    buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
  }),
);

export const overpassCacheEvents = getOrCreate("overpass_cache_events_total", () =>
  new client.Counter({
    name: "overpass_cache_events_total",
    help: "Overpass proxy cache events",
    labelNames: ["result"] as const, // hit | miss | coalesced
  }),
);

export const overpassCacheSize = getOrCreate("overpass_cache_size", () =>
  new client.Gauge({
    name: "overpass_cache_size",
    help: "Current number of entries in the Overpass proxy cache",
  }),
);

export const overpassUpstreamDuration = getOrCreate("overpass_upstream_duration_seconds", () =>
  new client.Histogram({
    name: "overpass_upstream_duration_seconds",
    help: "Duration of upstream Overpass API requests in seconds",
    labelNames: ["upstream"] as const,
    // Buckets go to 30s because our per-upstream timeout is 10s; a bit
    // of headroom catches slow-but-not-timed-out tails without overly
    // coarse resolution at the fast end where lz4 typically lands
    // (~100–500ms).
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 15, 30],
  }),
);

export const overpassUpstreamRequests = getOrCreate("overpass_upstream_requests_total", () =>
  new client.Counter({
    name: "overpass_upstream_requests_total",
    help: "Upstream Overpass API requests by upstream host and status",
    labelNames: ["upstream", "status"] as const,
  }),
);

export const registry = client.register;
