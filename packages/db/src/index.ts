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

export { plannerSchema, journalSchema };
