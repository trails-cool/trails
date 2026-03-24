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
    if (error instanceof Response) throw error; // Re-throw React Router responses (redirects, data())
    const message = error instanceof Error ? error.message : "Unknown error";
    if (
      message.includes("connect") ||
      message.includes("ECONNREFUSED") ||
      message.includes("DrizzleQueryError") ||
      message.includes("AggregateError") ||
      message.includes("database")
    ) {
      throw new Response(JSON.stringify({ error: "Database unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw error;
  });
}

export { plannerSchema, journalSchema };
