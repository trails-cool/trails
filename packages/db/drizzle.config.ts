import { defineConfig } from "drizzle-kit";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  schema: [
    path.resolve(__dirname, "src/schema/planner.ts"),
    path.resolve(__dirname, "src/schema/journal.ts"),
  ],
  out: path.resolve(__dirname, "migrations"),
  dialect: "postgresql",
  schemaFilter: ["planner", "journal"],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://trails:trails@localhost:5432/trails",
  },
});
