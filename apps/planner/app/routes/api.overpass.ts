import type { Route } from "./+types/api.overpass";
import { checkRateLimit } from "~/lib/rate-limit";
import { requireSession } from "~/lib/require-session";
import { overpassCacheEvents, overpassCacheSize } from "~/lib/metrics.server";
import {
  fetchWithFailover,
  type UpstreamResult,
} from "~/lib/overpass.server";

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

interface CacheEntry {
  body: string;
  contentType: string;
  expiresAt: number;
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
