import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/schema/planner.ts", "./src/schema/journal.ts"],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://trails:trails@localhost:5432/trails",
  },
});
