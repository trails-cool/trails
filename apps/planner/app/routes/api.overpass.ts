import type { Route } from "./+types/api.overpass";
import { checkRateLimit } from "~/lib/rate-limit";
import {
  overpassCacheEvents,
  overpassCacheSize,
  overpassUpstreamDuration,
  overpassUpstreamRequests,
} from "~/lib/metrics.server";

const UPSTREAM_URL = process.env.OVERPASS_URL ?? "https://overpass.private.coffee/api/interpreter";
const USER_AGENT = "trails.cool Planner (https://trails.cool; legal@trails.cool)";

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

interface CacheEntry {
  body: string;
  contentType: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<{ body: string; contentType: string; status: number; cacheable: boolean }>>();

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

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const expectedOrigin = `${requestUrl.protocol}//${requestUrl.host}`;
  if (!origin || origin !== expectedOrigin) {
    return new Response("Forbidden", { status: 403 });
  }

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
    pending = (async () => {
      const start = Date.now();
      try {
        const upstream = await fetch(UPSTREAM_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
          },
          body,
        });
        overpassUpstreamDuration.observe((Date.now() - start) / 1000);
        overpassUpstreamRequests.inc({ status: String(upstream.status) });
        const responseBody = await upstream.text();
        const contentType = upstream.headers.get("content-type") ?? "application/json";
        const cacheable = upstream.status === 200 && !responseBody.includes("rate_limited");
        return { body: responseBody, contentType, status: upstream.status, cacheable };
      } finally {
        inFlight.delete(cacheKey);
      }
    })();
    inFlight.set(cacheKey, pending);
  } else {
    overpassCacheEvents.inc({ result: "coalesced" });
  }

  let result;
  try {
    result = await pending;
  } catch {
    overpassUpstreamRequests.inc({ status: "error" });
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
