// Centralized access to the canonical origin for this Journal instance.
// `ORIGIN` is set in production to the public HTTPS URL; in dev it falls
// back to http://localhost:3000. Use the helper everywhere so the default
// can be changed in one place if needed.
export function getOrigin(): string {
  return process.env.ORIGIN ?? "http://localhost:3000";
}
