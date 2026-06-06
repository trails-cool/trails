import type { Route } from "./+types/api.well-known.nodeinfo";
import { handleFederationRequest } from "~/lib/federation.server";

/**
 * GET /.well-known/nodeinfo — NodeInfo discovery document pointing at
 * /nodeinfo/2.1 (served by routes/api.nodeinfo.ts). Handled by Fedify;
 * 404s while FEDERATION_ENABLED is off.
 */
export function loader({ request }: Route.LoaderArgs) {
  return handleFederationRequest(request);
}
