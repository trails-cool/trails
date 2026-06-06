import type { Route } from "./+types/users.$username.outbox";
import {
  federationEnabled,
  handleFederationRequest,
  isFederatableUser,
} from "~/lib/federation.server";

/**
 * GET /users/:username/outbox — paginated OrderedCollection of the
 * user's public activities as Create(Note) (spec: social-federation,
 * "Outbox publishes user's public activities"). Served by Fedify's
 * collection dispatcher; 404s for private users (checked here because
 * Fedify builds the collection-level response from counter/cursors
 * without consulting the page dispatcher) and while FEDERATION_ENABLED
 * is off.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  if (!federationEnabled() || !(await isFederatableUser(params.username))) {
    return new Response("Not Found", { status: 404 });
  }
  return handleFederationRequest(request);
}
