import client from "prom-client";
import { sql } from "drizzle-orm";
import { pois } from "@trails-cool/db/schema/planner";
import { getDb } from "./db.ts";

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

// POI serving endpoint (`/api/pois`) request counter. `status` is the
// outcome class: ok | rate_limited | bad_request | forbidden | unauthorized
// | error. Replaces the former Overpass proxy/upstream metrics now that POIs
// are served from the local index.
export const poiApiRequests = getOrCreate("poi_api_requests_total", () =>
  new client.Counter({
    name: "poi_api_requests_total",
    help: "POI serving endpoint requests by outcome status",
    labelNames: ["status"] as const,
  }),
);

// Index size per category, computed from the planner's own DB at scrape time
// (prom-client binds `this` to the gauge inside `collect`).
export const poiIndexRows = getOrCreate("poi_index_rows", () =>
  new client.Gauge({
    name: "poi_index_rows",
    help: "Number of POIs in the local index per category",
    labelNames: ["category"] as const,
    async collect() {
      try {
        const rows = await getDb()
          .select({ category: pois.category, count: sql<number>`count(*)::int` })
          .from(pois)
          .groupBy(pois.category);
        this.reset();
        for (const r of rows) this.set({ category: r.category }, r.count);
      } catch {
        // DB unavailable or table not yet created — leave last known values.
      }
    },
  }),
);

// Age of the freshest imported POI row, in seconds. Drives the stale-index
// alert (~6 weeks = one missed monthly refresh).
export const poiIndexAgeSeconds = getOrCreate("poi_index_age_seconds", () =>
  new client.Gauge({
    name: "poi_index_age_seconds",
    help: "Seconds since the most recent POI index import",
    async collect() {
      try {
        const [row] = await getDb()
          .select({
            age: sql<number | null>`extract(epoch from (now() - max(${pois.importedAt})))::float`,
          })
          .from(pois);
        if (row?.age != null) this.set(row.age);
      } catch {
        // DB unavailable or empty index — leave last known value.
      }
    },
  }),
);

export const registry = client.register;
