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
