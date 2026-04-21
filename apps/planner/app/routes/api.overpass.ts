import type { Route } from "./+types/api.overpass";
import { checkRateLimit } from "~/lib/rate-limit";
import { requireSession } from "~/lib/require-session";
import {
  overpassCacheEvents,
  overpassCacheSize,
  overpassUpstreamDuration,
  overpassUpstreamRequests,
} from "~/lib/metrics.server";

/**
 * Ordered list of upstream Overpass endpoints. We try each in turn
 * until one returns a usable response; on timeout, network error,
 * non-2xx status, or a body carrying Overpass's `rate_limited` runtime
 * error, we fall over to the next. The default list keeps us on
 * healthy community instances; `OVERPASS_URLS` overrides it and
 * `OVERPASS_URL` is kept as a single-entry backward-compat alias.
 */
const DEFAULT_UPSTREAMS = [
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

function loadUpstreams(): string[] {
  const list = process.env.OVERPASS_URLS ?? process.env.OVERPASS_URL;
  if (!list) return DEFAULT_UPSTREAMS;
  return list.split(",").map((s) => s.trim()).filter(Boolean);
}

const UPSTREAMS = loadUpstreams();
const USER_AGENT = "trails.cool Planner (https://trails.cool; legal@trails.cool)";

// Per-attempt wall-clock budget. Keep aggressive so failover kicks in
// quickly when an upstream is saturated — a single slow instance
// shouldn't cost the user minutes.
const PER_UPSTREAM_TIMEOUT_MS = 10_000;

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

interface CacheEntry {
  body: string;
  contentType: string;
  expiresAt: number;
}

interface UpstreamResult {
  body: string;
  contentType: string;
  status: number;
  cacheable: boolean;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<UpstreamResult>>();

function getFromCache(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  // LRU touch: move to end so oldest-first eviction works
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function putInCache(key: string, body: string, contentType: string) {
  while (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, { body, contentType, expiresAt: Date.now() + CACHE_TTL_MS });
  overpassCacheSize.set(cache.size);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

/**
 * Try each upstream in order until one returns a usable response.
 * Returns the first successful result, or `null` if every upstream
 * failed. `clientSignal` is the browser's abort signal — if the user
 * gives up before we succeed, we stop trying and propagate the abort
 * to the in-flight upstream fetch so we don't waste its capacity on a
 * request nobody wants anymore. Exported for tests; the action
 * handler calls it with the module-level `UPSTREAMS` list.
 */
export async function fetchWithFailover(
  body: string,
  clientSignal: AbortSignal,
  urls: readonly string[] = UPSTREAMS,
): Promise<UpstreamResult | null> {
  for (const url of urls) {
    if (clientSignal.aborted) break;
    const upstream = hostOf(url);
    const start = Date.now();
    try {
      const signal = AbortSignal.any([
        clientSignal,
        AbortSignal.timeout(PER_UPSTREAM_TIMEOUT_MS),
      ]);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body,
        signal,
      });
      const responseBody = await response.text();
      overpassUpstreamDuration.observe({ upstream }, (Date.now() - start) / 1000);
      overpassUpstreamRequests.inc({ upstream, status: String(response.status) });

      // Overpass returns 200 with a `rate_limited` runtime error when
      // the instance is throttling us. Treat that like a 5xx: try the
      // next upstream.
      if (!response.ok || responseBody.includes("rate_limited")) {
        continue;
      }

      return {
        body: responseBody,
        contentType: response.headers.get("content-type") ?? "application/json",
        status: 200,
        cacheable: true,
      };
    } catch (err) {
      overpassUpstreamDuration.observe({ upstream }, (Date.now() - start) / 1000);
      // If the CLIENT aborted, stop the whole loop — the user doesn't
      // want an answer anymore. Any other error (timeout, network,
      // DNS) counts as "this upstream failed, try the next."
      if (clientSignal.aborted) {
        overpassUpstreamRequests.inc({ upstream, status: "client-abort" });
        throw err;
      }
      const label = (err as Error).name === "TimeoutError" ? "timeout" : "error";
      overpassUpstreamRequests.inc({ upstream, status: label });
      continue;
    }
  }
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Same-origin check. Trust Caddy's X-Forwarded-* headers when present so
  // the check works behind the reverse proxy (request.url inside the container
  // is http://planner:3001/..., but the browser Origin is https://planner.trails.cool).
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = forwardedHost ?? requestUrl.host;
  const proto = forwardedProto ?? requestUrl.protocol.replace(":", "");
  const expectedOrigin = `${proto}://${host}`;
  if (!origin || origin !== expectedOrigin) {
    return new Response("Forbidden", { status: 403 });
  }

  // Session-bind: every proxy call must present a live planner session,
  // so anonymous abuse traffic can't ride on our trails.cool Origin.
  const session = await requireSession(request.headers.get("x-trails-session"));
  if (session instanceof Response) return session;

  const body = await request.text();
  const cacheKey = body;

  // Cache hit: skip rate limit and upstream entirely
  const cached = getFromCache(cacheKey);
  if (cached) {
    overpassCacheEvents.inc({ result: "hit" });
    return new Response(cached.body, {
      status: 200,
      headers: { "Content-Type": cached.contentType, "X-Cache": "hit" },
    });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = checkRateLimit(`overpass:${ip}`, { maxRequests: 120, windowMs: 60 * 1000 });
  if (!limit.allowed) {
    return new Response("Rate limit exceeded", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) },
    });
  }

  // Coalesce concurrent misses for the same key so multiple clients in the
  // same session don't each hit upstream for the identical bbox.
  let pending = inFlight.get(cacheKey);
  if (!pending) {
    overpassCacheEvents.inc({ result: "miss" });
    pending = (async (): Promise<UpstreamResult> => {
      try {
        const result = await fetchWithFailover(body, request.signal);
        if (!result) {
          throw new Error("all upstreams failed");
        }
        return result;
      } finally {
        inFlight.delete(cacheKey);
      }
    })();
    inFlight.set(cacheKey, pending);
  } else {
    overpassCacheEvents.inc({ result: "coalesced" });
  }

  let result: UpstreamResult;
  try {
    result = await pending;
  } catch {
    return new Response("Upstream Overpass unavailable", { status: 502 });
  }

  if (result.cacheable) {
    putInCache(cacheKey, result.body, result.contentType);
  }

  return new Response(result.body, {
    status: result.status,
    headers: { "Content-Type": result.contentType, "X-Cache": "miss" },
  });
}
