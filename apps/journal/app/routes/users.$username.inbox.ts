import type { Route } from "./+types/users.$username.inbox";
import { handleFederationRequest, federationSourceHost } from "~/lib/federation.server";
import { consumeRateLimit } from "~/lib/rate-limit.server";

/**
 * POST /users/:username/inbox — ActivityPub inbox (spec:
 * social-federation, "Narrow inbox"). Fedify verifies the HTTP
 * Signature and dispatches to the registered listeners; everything
 * else about the request is its problem. We rate-limit per source
 * instance *before* signature verification so a hostile instance
 * can't burn CPU on key fetches + crypto (spec 4.8: 60 req / 5 min
 * per host).
 */
export function action({ request }: Route.ActionArgs) {
  const { allowed, resetMs } = consumeRateLimit({
    scope: "federation-inbox",
    key: federationSourceHost(request),
    limit: 60,
    windowMs: 5 * 60 * 1000,
  });
  if (!allowed) {
    return Promise.resolve(
      new Response("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(resetMs / 1000)) },
      }),
    );
  }
  return handleFederationRequest(request);
}

/** Inboxes are POST-only; GET has no representation here. */
export function loader() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
