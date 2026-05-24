import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as plannerSchema from "./schema/planner.ts";
import * as journalSchema from "./schema/journal.ts";

const DEV_DB_URL = "postgres://trails:trails@localhost:5432/trails";

/**
 * Resolve the database URL with fail-loud semantics in production.
 * In dev/test we silently fall back to the local Compose URL so the
 * loop keeps working; in prod we refuse to start rather than
 * silently pointing at localhost (which either won't resolve, or
 * worse, will connect to an unintended database on the host).
 */
export function getDatabaseUrl(override?: string): string {
  if (override) return override;
  const url = process.env.DATABASE_URL;
  // Playwright runs `react-router serve` which boots with
  // NODE_ENV=production, but the CI E2E suite legitimately points at a
  // local Postgres using the dev URL. E2E=true is the explicit opt-out.
  const isProd = process.env.NODE_ENV === "production" && process.env.E2E !== "true";
  if (isProd) {
    if (!url || url === DEV_DB_URL) {
      throw new Error(
        "Refusing to start: DATABASE_URL is unset or matches the dev default. " +
          "Set DATABASE_URL to the production connection string.",
      );
    }
    return url;
  }
  return url ?? DEV_DB_URL;
}

export function createDb(connectionString?: string) {
  const client = postgres(getDatabaseUrl(connectionString));
  return drizzle(client, {
    schema: { ...plannerSchema, ...journalSchema },
  });
}

export type Database = ReturnType<typeof createDb>;

/**
 * Wraps a route handler (loader/action) to catch database errors
 * and return a 503 Service Unavailable instead of crashing.
 */
export function withDb<T>(handler: () => Promise<T>): Promise<T> {
  return handler().catch((error) => {
    // Re-throw React Router responses and data() throws:
    // - Response instances (redirects, manual responses)
    // - DataWithResponseInit from data() throws (type + data + init)
    if (
      error instanceof Response ||
      (error != null && typeof error === "object" && error.type === "DataWithResponseInit")
    ) {
      throw error;
    }

    // Database error — throw as a 503 that the error boundary will catch
    const message = error instanceof Error ? error.message : String(error);
    console.error("[withDb] Database error:", message);

    throw new Response("Database unavailable", { status: 503, statusText: "Service Unavailable" });
  });
}

export { plannerSchema, journalSchema };
