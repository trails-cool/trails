import {
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

export const UPSTREAMS = loadUpstreams();
const USER_AGENT = "trails.cool Planner (https://trails.cool; legal@trails.cool)";

// Per-attempt wall-clock budget. Keep aggressive so failover kicks in
// quickly when an upstream is saturated — a single slow instance
// shouldn't cost the user minutes.
const PER_UPSTREAM_TIMEOUT_MS = 10_000;

export interface UpstreamResult {
  body: string;
  contentType: string;
  status: number;
  cacheable: boolean;
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
 * request nobody wants anymore.
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
