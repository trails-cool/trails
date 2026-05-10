import { data } from "react-router";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb } from "~/lib/db";

// Only available when the server is started with E2E=true.
function assertE2EEnabled() {
  if (process.env.E2E !== "true") {
    throw new Response("Not found", { status: 404 });
  }
}

/**
 * GET /api/e2e/route/:id
 *
 * Returns minimal route metadata for e2e assertions — specifically whether
 * the PostGIS geom column is populated. Gated behind E2E=true.
 */
export async function loader({ params }: { params: { id: string } }) {
  assertE2EEnabled();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT id, geom IS NOT NULL AS has_geom FROM journal.routes WHERE id = ${params.id}`,
  );
  const row = (result as unknown as Array<{ id: string; has_geom: boolean }>)[0];
  if (!row) return data({ error: "Not found" }, { status: 404 });
  return data({ id: row.id, hasGeom: row.has_geom });
}
