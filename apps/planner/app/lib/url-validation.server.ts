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
 * Whether to reject callback hosts pointing at private / loopback /
 * link-local / cloud-metadata ranges. Active in real production only —
 * mirrors the `requireSecret` guard in the journal's config.server.ts.
 * Dev and E2E legitimately point the callback at the journal on
 * `localhost`, so blocking there would break the save flow.
 */
function blockPrivateAddresses(): boolean {
  return process.env.NODE_ENV === "production" && process.env.E2E !== "true";
}

function isBlockedIpv4(ip: string): boolean {
  const o = ip.split(".").map((n) => Number(n));
  // Malformed dotted-quad → treat as blocked (fail safe).
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = o as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true; // this-host, RFC1918 /8, loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918 /12
  if (a === 192 && b === 168) return true; // RFC1918 /16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  return false;
}

/**
 * Literal private/loopback/link-local hosts. Catches IP literals and
 * `localhost`; it does NOT resolve DNS, so a public name that resolves
 * to a private IP (DNS-rebinding-style SSRF) is not blocked here — set
 * PLANNER_CALLBACK_ALLOWED_HOSTS to close that where the callback host
 * is known ahead of time.
 */
function isBlockedHost(hostname: string): boolean {
  // Node keeps IPv6 brackets on URL.hostname (e.g. "[::1]"); strip them.
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.includes(":")) {
    // IPv6.
    if (h === "::1" || h === "::") return true;
    if (h.startsWith("fc") || h.startsWith("fd")) return true; // ULA fc00::/7
    if (h.startsWith("fe8") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb")) {
      return true; // link-local fe80::/10
    }
    // IPv4-mapped (::ffff:a.b.c.d, which Node may render in hex form).
    // Reaching IPv4 through a mapped address is inherently suspect for a
    // callback target, so block the whole prefix.
    if (h.startsWith("::ffff:")) return true;
    return false;
  }
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return isBlockedIpv4(h);
  return false;
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
    // An explicit allowlist is the operator's decision and the strongest
    // control; a host that matches it is trusted even if it's private.
    if (!opts.allowedHosts.includes(parsed.host)) {
      return { ok: false, reason: `host ${parsed.host} not on allowlist` };
    }
  } else if (blockPrivateAddresses() && isBlockedHost(parsed.hostname)) {
    return {
      ok: false,
      reason: `host ${parsed.hostname} is a private/loopback/link-local address`,
    };
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
