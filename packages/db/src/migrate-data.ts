// Runs hand-written SQL data migrations from packages/db/migrations/*.sql in
// lexical order. Each file is expected to be idempotent (safe to re-run);
// there is no migrations table.
//
// Why this exists: we use `drizzle-kit push --force` for schema, which is
// fine for column adds and renames but unsafe when a unique-key change
// requires collapsing existing rows first. The wahoo-route-update change is
// the first such case.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { getDatabaseUrl } from "./index.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "..", "migrations");

async function main() {
  const sql = postgres(getDatabaseUrl());
  try {
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const f of files) {
      const body = readFileSync(path.join(migrationsDir, f), "utf8");
      console.log(`[migrate-data] applying ${f}`);
      await sql.unsafe(body);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
