import type { Route } from "./+types/api.well-known.webfinger";
import { handleFederationRequest } from "~/lib/federation.server";

/**
 * GET /.well-known/webfinger?resource=acct:user@domain
 *
 * ActivityPub discovery: resolves an acct: handle to the user's actor IRI.
 * Fully handled by Fedify; 404s while FEDERATION_ENABLED is off, and for
 * users whose profile_visibility is not 'public'.
 */
export function loader({ request }: Route.LoaderArgs) {
  return handleFederationRequest(request);
}
