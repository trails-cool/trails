// Shared validation for query-param URLs that flow into either an
// outbound fetch (callbackUrl) or a rendered link (returnUrl).
// Keeps the new-session and session-detail loaders honest without
// scattering ad-hoc string checks.

const SAFE_SCHEMES = new Set(["http:", "https:"]);

/**
 * Result type so callers can decide whether to reject the request or
 * just drop the value (e.g. returnUrl is optional UX; callbackUrl is
 * load-bearing).
 */
export interface UrlValidationResult {
  ok: boolean;
  reason?: string;
  url?: URL;
}

/**
 * Validate a URL string for use as a fetch target. Requires absolute
 * http(s) URL. If `allowedHosts` is provided, the host must be on the
 * list — matches behavior of standard "open redirect" allowlists.
 */
export function validateFetchUrl(
  raw: string,
  opts: { allowedHosts?: string[]; maxLength?: number } = {},
): UrlValidationResult {
  const maxLength = opts.maxLength ?? 2048;
  if (raw.length > maxLength) {
    return { ok: false, reason: `url exceeds ${maxLength} chars` };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: "not a valid absolute URL" };
  }
  if (!SAFE_SCHEMES.has(parsed.protocol)) {
    return { ok: false, reason: `disallowed scheme ${parsed.protocol}` };
  }
  if (opts.allowedHosts && opts.allowedHosts.length > 0) {
    if (!opts.allowedHosts.includes(parsed.host)) {
      return { ok: false, reason: `host ${parsed.host} not on allowlist` };
    }
  }
  return { ok: true, url: parsed };
}

/**
 * Validate a URL string for use as a rendered `<a href>`. Accepts
 * either a same-origin relative path (starts with `/` and doesn't
 * start with `//`) or an absolute http(s) URL. The browser still
 * follows the link, so the goal is to refuse `javascript:` and
 * `data:` schemes which would execute on click.
 */
export function validateRedirectUrl(
  raw: string,
  opts: { maxLength?: number } = {},
): UrlValidationResult {
  const maxLength = opts.maxLength ?? 2048;
  if (raw.length > maxLength) {
    return { ok: false, reason: `url exceeds ${maxLength} chars` };
  }
  // Same-origin relative path. `//host` would be protocol-relative and
  // bypass the scheme check, so reject those explicitly.
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return { ok: true };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: "not a valid absolute or relative URL" };
  }
  if (!SAFE_SCHEMES.has(parsed.protocol)) {
    return { ok: false, reason: `disallowed scheme ${parsed.protocol}` };
  }
  return { ok: true, url: parsed };
}

/**
 * Parse the `PLANNER_CALLBACK_ALLOWED_HOSTS` env (comma-separated
 * hostnames). When set, callbackUrl hosts must match. When unset,
 * no allowlist is applied — useful in dev/self-hosted where the
 * journal lives somewhere unpredictable.
 */
export function getCallbackAllowedHosts(): string[] | undefined {
  const raw = process.env.PLANNER_CALLBACK_ALLOWED_HOSTS;
  if (!raw) return undefined;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
