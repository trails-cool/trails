import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Metrics module pulls in prom-client and registers processes-wide
// metrics on import; mock it out so tests aren't entangled with
// the registry and can assert on label values instead.
vi.mock("~/lib/metrics.server", () => ({
  overpassCacheEvents: { inc: vi.fn() },
  overpassCacheSize: { set: vi.fn() },
  overpassUpstreamDuration: { observe: vi.fn() },
  overpassUpstreamRequests: { inc: vi.fn() },
}));

import { fetchWithFailover } from "./api.overpass";
import {
  overpassUpstreamRequests,
  overpassUpstreamDuration,
} from "~/lib/metrics.server";

const URL_A = "https://a.example/api/interpreter";
const URL_B = "https://b.example/api/interpreter";
const URL_C = "https://c.example/api/interpreter";

function makeResponse(
  body: string,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(body, {
    status: init.status ?? 200,
    headers: init.headers ?? { "content-type": "application/json" },
  });
}

beforeEach(() => {
  // `clearAllMocks` zeroes call-history on module-level mocks like
  // `overpassUpstreamRequests.inc`, which would otherwise accumulate
  // across test cases and break assertions that inspect call counts.
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithFailover", () => {
  it("returns the first upstream's response when it succeeds", async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce(makeResponse('{"ok":1}'));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchWithFailover(
      "data=...",
      new AbortController().signal,
      [URL_A, URL_B],
    );

    expect(result?.status).toBe(200);
    expect(result?.body).toBe('{"ok":1}');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(URL_A, expect.any(Object));
    expect(overpassUpstreamRequests.inc).toHaveBeenCalledWith({
      upstream: "a.example",
      status: "200",
    });
  });

  it("falls over to the next upstream on non-2xx", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(makeResponse("gateway timeout", { status: 504 }))
      .mockResolvedValueOnce(makeResponse('{"elements":[]}'));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchWithFailover(
      "data=...",
      new AbortController().signal,
      [URL_A, URL_B],
    );

    expect(result?.body).toBe('{"elements":[]}');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(overpassUpstreamRequests.inc).toHaveBeenCalledWith({
      upstream: "a.example",
      status: "504",
    });
    expect(overpassUpstreamRequests.inc).toHaveBeenCalledWith({
      upstream: "b.example",
      status: "200",
    });
  });

  it("falls over when the body carries Overpass's rate_limited runtime error", async () => {
    // Overpass returns HTTP 200 with a `rate_limited` marker in the
    // body when it's throttling. Treat that as an upstream failure.
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(makeResponse('{"error":"rate_limited"}'))
      .mockResolvedValueOnce(makeResponse('{"elements":[]}'));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchWithFailover(
      "data=...",
      new AbortController().signal,
      [URL_A, URL_B],
    );

    expect(result?.body).toBe('{"elements":[]}');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("falls over on network / timeout errors", async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED"))
      .mockResolvedValueOnce(makeResponse('{"elements":[]}'));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchWithFailover(
      "data=...",
      new AbortController().signal,
      [URL_A, URL_B],
    );

    expect(result?.body).toBe('{"elements":[]}');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(overpassUpstreamRequests.inc).toHaveBeenCalledWith({
      upstream: "a.example",
      status: "error",
    });
  });

  it("tags TimeoutError distinctly from other errors", async () => {
    const timeoutErr = new Error("aborted");
    timeoutErr.name = "TimeoutError";
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(timeoutErr)
      .mockResolvedValueOnce(makeResponse('{"elements":[]}'));
    vi.stubGlobal("fetch", fetchSpy);

    await fetchWithFailover(
      "data=...",
      new AbortController().signal,
      [URL_A, URL_B],
    );

    expect(overpassUpstreamRequests.inc).toHaveBeenCalledWith({
      upstream: "a.example",
      status: "timeout",
    });
  });

  it("returns null when every upstream fails", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(makeResponse("bad", { status: 500 }))
      .mockResolvedValueOnce(makeResponse("bad", { status: 502 }))
      .mockResolvedValueOnce(makeResponse("bad", { status: 503 }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchWithFailover(
      "data=...",
      new AbortController().signal,
      [URL_A, URL_B, URL_C],
    );

    expect(result).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("stops iterating when the client aborts, rethrows, and doesn't try later upstreams", async () => {
    const controller = new AbortController();
    const abortErr = new DOMException("aborted", "AbortError");
    const fetchSpy = vi.fn().mockImplementationOnce(async () => {
      controller.abort();
      throw abortErr;
    });
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      fetchWithFailover("data=...", controller.signal, [URL_A, URL_B]),
    ).rejects.toBe(abortErr);

    // Only A was attempted; B never got a chance.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(overpassUpstreamRequests.inc).toHaveBeenCalledWith({
      upstream: "a.example",
      status: "client-abort",
    });
  });

  it("records latency with the upstream label on every attempt (success and failure)", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(makeResponse("bad", { status: 503 }))
      .mockResolvedValueOnce(makeResponse('{"elements":[]}'));
    vi.stubGlobal("fetch", fetchSpy);

    await fetchWithFailover(
      "data=...",
      new AbortController().signal,
      [URL_A, URL_B],
    );

    const calls = vi.mocked(overpassUpstreamDuration.observe).mock.calls;
    const upstreams = calls.map(
      (c) => (c[0] as unknown as { upstream: string }).upstream,
    );
    expect(upstreams).toEqual(["a.example", "b.example"]);
  });
});
