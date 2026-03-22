import { pgSchema, text, timestamp, boolean, customType } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const plannerSchema = pgSchema("planner");

export const sessions = plannerSchema.table("sessions", {
  id: text("id").primaryKey(),
  yjsState: bytea("yjs_state"),
  callbackUrl: text("callback_url"),
  callbackToken: text("callback_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActivity: timestamp("last_activity", { withTimezone: true }).notNull().defaultNow(),
  closed: boolean("closed").notNull().default(false),
});
