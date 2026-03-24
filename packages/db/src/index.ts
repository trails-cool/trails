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
    // Re-throw anything that looks like a React Router response:
    // - Response (redirects)
    // - ErrorResponseImpl from data() throws (has status + data)
    if (
      error instanceof Response ||
      (error != null && typeof error === "object" && "status" in error)
    ) {
      throw error;
    }

    // Database error — throw as a 503 that the error boundary will catch
    const message = error instanceof Error ? error.message : String(error);
    console.error("[withDb] Database error:", message);

    // Use the same shape as data() throw so isRouteErrorResponse works
    throw new Response("Database unavailable", { status: 503, statusText: "Service Unavailable" });
  });
}

export { plannerSchema, journalSchema };
