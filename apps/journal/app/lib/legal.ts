/**
 * Version identifier for the currently-published Terms of Service.
 *
 * Stored on `users.terms_version` when a user accepts the Terms at
 * registration. Bump this string whenever the Terms text changes in a way
 * that warrants a re-acceptance — typically on each legal-review update.
 *
 * Kept as a plain date string (the "Last updated" date shown on the Terms
 * page itself) so spec, storage, and UI stay in lockstep without a separate
 * versioning scheme.
 */
export const TERMS_VERSION = "2026-04-19";

/**
 * "Last updated" date shown on the Privacy Policy. Privacy changes don't
 * require re-acceptance (the policy is informational, not contract), so this
 * is display-only — not persisted.
 */
export const PRIVACY_LAST_UPDATED = "2026-04-20";
