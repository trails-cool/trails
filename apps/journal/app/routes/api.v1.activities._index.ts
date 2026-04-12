import type { Route } from "./+types/api.v1.activities._index";
import { requireApiUser, apiError } from "~/lib/api-guard.server";
import { listActivities, createActivity } from "~/lib/activities.server";
import {
  PaginationQuerySchema,
  CreateActivityRequestSchema,
  ERROR_CODES,
} from "@trails-cool/api";

/** GET /api/v1/activities — paginated activity list */
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

  const allActivities = await listActivities(user.id);
  const { cursor, limit } = query.data;

  let startIdx = 0;
  if (cursor) {
    const idx = allActivities.findIndex((a) => a.id === cursor);
    startIdx = idx >= 0 ? idx + 1 : 0;
  }

  const page = allActivities.slice(startIdx, startIdx + limit);
  const nextCursor = startIdx + limit < allActivities.length ? page[page.length - 1]?.id ?? null : null;

  return Response.json({
    activities: page.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      routeId: a.routeId,
      routeName: null, // TODO: join route name
      distance: a.distance,
      duration: a.duration,
      elevationGain: a.elevationGain,
      elevationLoss: a.elevationLoss,
      startedAt: a.startedAt?.toISOString() ?? null,
      geojson: a.geojson,
      createdAt: a.createdAt.toISOString(),
    })),
    nextCursor,
  });
}

/** POST /api/v1/activities — create a new activity */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const user = await requireApiUser(request);

  const body = await request.json().catch(() => null);
  const parsed = CreateActivityRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, ERROR_CODES.VALIDATION_ERROR, "Validation failed",
      parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })));
  }

  const id = await createActivity(user.id, {
    ...parsed.data,
    startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
  });
  return Response.json({ id }, { status: 201 });
}
