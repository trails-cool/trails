import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as plannerSchema from "./schema/planner";
import * as journalSchema from "./schema/journal";

export function createDb(connectionString?: string) {
  const client = postgres(
    connectionString ?? process.env.DATABASE_URL ?? "postgres://trails:trails@localhost:5432/trails",
  );
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
    // Re-throw React Router responses (redirects, data() throws)
    if (error instanceof Response) throw error;

    // Any other error from a DB-wrapped handler is treated as DB unavailable
    const message = error instanceof Error ? error.message : String(error);
    console.error("[withDb] Database error:", message);

    throw new Response(JSON.stringify({ error: "Database unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  });
}

export { plannerSchema, journalSchema };
