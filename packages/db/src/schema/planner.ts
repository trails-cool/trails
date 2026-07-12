import { pgSchema, text, timestamp, boolean, jsonb, customType, index, primaryKey } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// Centroid point in WGS84. Ways/relations are reduced to their centroid at
// extract time (matching the old Overpass `out center`), so every POI is a
// single point regardless of its OSM geometry.
const point = customType<{ data: string }>({
  dataType() {
    return "geometry(Point, 4326)";
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
}, (t) => ({
  // Hourly `expireSessions()` job runs `DELETE WHERE last_activity < cutoff`.
  // Without this index it's a full table scan that grows linearly with
  // total sessions ever created.
  lastActivityIdx: index("sessions_last_activity_idx").on(t.lastActivity),
}));

/**
 * Self-hosted POI index. Fed monthly by the extract pipeline (osmium filter on
 * the BRouter host) + the flagship import job's atomic staging swap — never
 * written at request time. Served read-only by `/api/pois` for the planner's
 * map overlays, replacing the former Overpass proxy.
 *
 * An OSM element that matches more than one category is stored once per
 * category (part of the composite primary key), because the client treats each
 * category's markers independently.
 */
export const pois = plannerSchema.table("pois", {
  // OSM element type: 'n' (node), 'w' (way), or 'r' (relation).
  osmType: text("osm_type").notNull(),
  osmId: text("osm_id").notNull(),
  category: text("category").notNull(),
  name: text("name"),
  geom: point("geom").notNull(),
  tags: jsonb("tags").$type<Record<string, string>>().notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Named explicitly so the import job's atomic swap can rename the staging
  // table's PK to this exact name — keeping `db:push` drift-free post-swap.
  pk: primaryKey({ name: "pois_pkey", columns: [t.osmType, t.osmId, t.category] }),
  // GiST spatial index for the bbox intersection in the serving query.
  geomIdx: index("pois_geom_idx").using("gist", t.geom),
  // btree on category so `category = ANY($cats)` is index-driven.
  categoryIdx: index("pois_category_idx").on(t.category),
}));
