// Centralized access to the canonical origin for this Journal instance.
// `ORIGIN` is set in production to the public HTTPS URL; in dev it falls
// back to http://localhost:3000. Use the helper everywhere so the default
// can be changed in one place if needed.
export function getOrigin(): string {
  return process.env.ORIGIN ?? "http://localhost:3000";
}

/**
 * Read a required secret from the environment. Returns the env value when
 * set. In production, throws if the env var is missing or matches the
 * known-public dev fallback — silently shipping a default secret to prod
 * is a credential leak. In dev/test, returns the supplied fallback so the
 * local loop keeps working without ceremony.
 *
 * Use this for any value where a leaked default would be a security
 * incident: signing keys, session secrets, database credentials.
 */
export function requireSecret(name: string, devFallback: string): string {
  const value = process.env[name];
  // Playwright runs `react-router serve` (NODE_ENV=production) against a
  // local stack. E2E=true is the explicit opt-out so the guard still
  // bites in real prod deploys.
  const isProd = process.env.NODE_ENV === "production" && process.env.E2E !== "true";
  if (isProd) {
    if (!value || value === devFallback) {
      throw new Error(
        `Refusing to start: ${name} is unset or matches the known-public dev fallback. ` +
          `Set ${name} to a strong, unique value in production.`,
      );
    }
    return value;
  }
  return value ?? devFallback;
}
