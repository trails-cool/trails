import client from "prom-client";

// Collect default Node.js metrics (event loop, heap, GC)
// Guard against duplicate registration during HMR
if (!client.register.getSingleMetric("process_cpu_user_seconds_total")) {
  client.collectDefaultMetrics();
}

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const plannerActiveSessions = new client.Gauge({
  name: "planner_active_sessions",
  help: "Number of active planner sessions",
});

export const plannerConnectedClients = new client.Gauge({
  name: "planner_connected_clients",
  help: "Number of connected WebSocket clients",
});

export const brouterRequestDuration = new client.Histogram({
  name: "brouter_request_duration_seconds",
  help: "Duration of BRouter API requests in seconds",
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
});

export const registry = client.register;
