import type { Route } from "./+types/api.v1.routes.compute";
import { requireApiUser, apiError } from "~/lib/api-guard.server";
import { ComputeRouteRequestSchema, ERROR_CODES } from "@trails-cool/api";

const BROUTER_URL = process.env.BROUTER_URL ?? "http://localhost:17777";

/** POST /api/v1/routes/compute — proxy to BRouter */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  await requireApiUser(request);

  const body = await request.json().catch(() => null);
  const parsed = ComputeRouteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, ERROR_CODES.VALIDATION_ERROR, "Validation failed",
      parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })));
  }

  const { waypoints, profile } = parsed.data;
  const lonlats = waypoints.map((w) => `${w.lon},${w.lat}`).join("|");

  const brouterUrl = `${BROUTER_URL}/brouter?lonlats=${lonlats}&profile=${profile}&alternativeidx=0&format=geojson`;

  try {
    const resp = await fetch(brouterUrl);
    if (!resp.ok) {
      return apiError(502, ERROR_CODES.INTERNAL_ERROR, `BRouter returned ${resp.status}`);
    }
    const geojson = await resp.json();
    return Response.json(geojson);
  } catch {
    return apiError(502, ERROR_CODES.INTERNAL_ERROR, "BRouter unavailable");
  }
}
