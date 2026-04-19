import client from "prom-client";

// Collect default Node.js metrics (event loop, heap, GC)
client.collectDefaultMetrics();

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

/**
 * Count of synthetic demo-bot routes currently in the database. Scraped
 * by the background worker after each generation run so the Grafana
 * board stays live without a /metrics handler on the worker process.
 */
export const demoBotSyntheticRoutesTotal = new client.Gauge({
  name: "demo_bot_synthetic_routes_total",
  help: "Total synthetic demo-bot routes currently stored",
});

export const demoBotSyntheticActivitiesTotal = new client.Gauge({
  name: "demo_bot_synthetic_activities_total",
  help: "Total synthetic demo-bot activities currently stored",
});

export const registry = client.register;
