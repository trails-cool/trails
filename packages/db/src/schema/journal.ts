import {
  pgSchema,
  text,
  timestamp,
  integer,
  real,
  jsonb,
  customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const lineString = customType<{ data: string }>({
  dataType() {
    return "geometry(LineString, 4326)";
  },
});

export const journalSchema = pgSchema("journal");

export const users = journalSchema.table("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  bio: text("bio"),
  domain: text("domain").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const routes = journalSchema.table("routes", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description").default(""),
  gpx: text("gpx"),
  geom: lineString("geom"),
  routingProfile: text("routing_profile"),
  distance: real("distance"),
  elevationGain: real("elevation_gain"),
  elevationLoss: real("elevation_loss"),
  dayBreaks: jsonb("day_breaks").$type<number[]>(),
  tags: jsonb("tags").$type<string[]>(),
  plannerState: bytea("planner_state"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const routeVersions = journalSchema.table("route_versions", {
  id: text("id").primaryKey(),
  routeId: text("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  gpx: text("gpx").notNull(),
  createdBy: text("created_by").references(() => users.id),
  changeDescription: text("change_description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activities = journalSchema.table("activities", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  routeId: text("route_id").references(() => routes.id),
  name: text("name").notNull(),
  description: text("description").default(""),
  gpx: text("gpx"),
  geom: lineString("geom"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  duration: integer("duration"),
  distance: real("distance"),
  elevationGain: real("elevation_gain"),
  elevationLoss: real("elevation_loss"),
  photos: jsonb("photos").$type<string[]>(),
  participants: jsonb("participants").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
