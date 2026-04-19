import type { Route } from "./+types/api.v1.routes._index";
import { requireApiUser, apiError } from "~/lib/api-guard.server";
import { listRoutes, createRoute } from "~/lib/routes.server";
import {
  PaginationQuerySchema,
  CreateRouteRequestSchema,
  ERROR_CODES,
  zodIssuesToFieldErrors,
} from "@trails-cool/api";

/** GET /api/v1/routes — paginated route list */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  const url = new URL(request.url);
  const query = PaginationQuerySchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!query.success) {
    return apiError(400, ERROR_CODES.VALIDATION_ERROR, "Invalid pagination params");
  }

  const allRoutes = await listRoutes(user.id);
  const { cursor, limit } = query.data;

  let startIdx = 0;
  if (cursor) {
    const idx = allRoutes.findIndex((r) => r.id === cursor);
    startIdx = idx >= 0 ? idx + 1 : 0;
  }

  const page = allRoutes.slice(startIdx, startIdx + limit);
  const nextCursor = startIdx + limit < allRoutes.length ? page[page.length - 1]?.id ?? null : null;

  return Response.json({
    routes: page.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      distance: r.distance,
      elevationGain: r.elevationGain,
      elevationLoss: r.elevationLoss,
      routingProfile: r.routingProfile,
      dayBreaks: r.dayBreaks ?? [],
      geojson: r.geojson,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    nextCursor,
  });
}

/** POST /api/v1/routes — create a new route */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const user = await requireApiUser(request);

  const body = await request.json().catch(() => null);
  const parsed = CreateRouteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, ERROR_CODES.VALIDATION_ERROR, "Validation failed",
      zodIssuesToFieldErrors(parsed.error));
  }

  const id = await createRoute(user.id, parsed.data);
  return Response.json({ id }, { status: 201 });
}
