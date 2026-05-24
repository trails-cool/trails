import { API_VERSION } from "@trails-cool/api";
import { getOrigin } from "~/lib/config.server";

/**
 * GET /.well-known/trails-cool
 *
 * Discovery endpoint for mobile apps and federation.
 * Returns instance metadata including API version, name, and base URL.
 */
export function loader() {
  const domain = process.env.DOMAIN ?? "localhost";
  const origin = getOrigin();

  return Response.json({
    apiVersion: API_VERSION,
    instanceName: domain,
    apiBaseUrl: `${origin}/api/v1`,
  });
}
