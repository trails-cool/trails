import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://trails:trails@localhost:5432/trails";

export const sql = postgres(connectionString);

export async function initDb() {
  await sql`
    CREATE SCHEMA IF NOT EXISTS planner
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS planner.sessions (
      id TEXT PRIMARY KEY,
      yjs_state BYTEA,
      callback_url TEXT,
      callback_token TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed BOOLEAN NOT NULL DEFAULT FALSE
    )
  `;
}
