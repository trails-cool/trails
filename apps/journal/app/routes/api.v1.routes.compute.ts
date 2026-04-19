import type { Route } from "./+types/api.v1.routes.compute";
import { requireApiUser, apiError } from "~/lib/api-guard.server";
import { ComputeRouteRequestSchema, ERROR_CODES, zodIssuesToFieldErrors } from "@trails-cool/api";

const PLANNER_URL = process.env.PLANNER_URL ?? "http://localhost:3001";

/** POST /api/v1/routes/compute — server-to-server proxy through the planner. */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  await requireApiUser(request);

  const body = await request.json().catch(() => null);
  const parsed = ComputeRouteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, ERROR_CODES.VALIDATION_ERROR, "Validation failed",
      zodIssuesToFieldErrors(parsed.error));
  }

  try {
    const resp = await fetch(`${PLANNER_URL}/api/route`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!resp.ok) {
      return apiError(resp.status === 422 ? 422 : 502, ERROR_CODES.INTERNAL_ERROR, `Planner returned ${resp.status}`);
    }
    const payload = await resp.json();
    return Response.json(payload);
  } catch {
    return apiError(502, ERROR_CODES.INTERNAL_ERROR, "Planner unavailable");
  }
}
