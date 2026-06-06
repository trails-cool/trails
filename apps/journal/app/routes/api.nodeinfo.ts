import type { Route } from "./+types/api.nodeinfo";
import { handleFederationRequest } from "~/lib/federation.server";

/**
 * GET /nodeinfo/2.1
 *
 * Standard fediverse software discovery (NodeInfo). The
 * trails-to-trails outbound check reads this from remote instances to
 * decide whether a follow target runs trails.cool. Discovery document
 * lives at /.well-known/nodeinfo (routes/api.well-known.nodeinfo.ts).
 * 404s while FEDERATION_ENABLED is off.
 */
export function loader({ request }: Route.LoaderArgs) {
  return handleFederationRequest(request);
}
