import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  parseWebhook: vi.fn(),
  handle: vi.fn(),
}));
const { parseWebhook, handle } = mocks;

vi.mock("~/lib/connected-services", () => ({
  getManifest: (id: string) =>
    id === "test"
      ? {
          id: "test",
          webhookReceiver: { parseWebhook: mocks.parseWebhook, handle: mocks.handle },
        }
      : null,
}));

import { action } from "./api.sync.webhook.$provider.ts";

function makeRequest(body: string | object, method = "POST"): Request {
  const init: RequestInit = { method, headers: { "content-type": "application/json" } };
  if (method !== "GET" && method !== "HEAD") {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return new Request("http://test.local/api/sync/webhook/test", init);
}

describe("POST /api/sync/webhook/:provider", () => {
  beforeEach(() => {
    parseWebhook.mockReset();
    handle.mockReset();
    parseWebhook.mockReturnValue([]);
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function statusOf(result: unknown): number {
    if (result instanceof Response) return result.status;
    const init = (result as { init?: { status?: number } } | undefined)?.init;
    return init?.status ?? 200;
  }

  async function call(body: string | object, opts: { method?: string; provider?: string } = {}) {
    return action({
      request: makeRequest(body, opts.method ?? "POST"),
      params: { provider: opts.provider ?? "test" },
      context: {} as unknown,
    } as never);
  }

  it("returns 405 for non-POST", async () => {
    const res = await call({}, { method: "GET" });
    expect(statusOf(res)).toBe(405);
  });

  it("returns 200 silently for unknown provider", async () => {
    const res = await call({}, { provider: "no-such-provider" });
    expect(statusOf(res)).toBe(200);
    expect(parseWebhook).not.toHaveBeenCalled();
  });

  it("returns 200 silently and does not invoke parseWebhook on malformed JSON", async () => {
    const res = await call("not-json{");
    expect(statusOf(res)).toBe(200);
    expect(parseWebhook).not.toHaveBeenCalled();
  });

  it("returns 200 silently and does not invoke parseWebhook on a non-object body", async () => {
    const res = await call("42");
    expect(statusOf(res)).toBe(200);
    expect(parseWebhook).not.toHaveBeenCalled();
  });

  it("rejects when webhook_token does not match", async () => {
    vi.stubEnv("TEST_WEBHOOK_TOKEN", "expected");
    const res = await call({ webhook_token: "wrong" });
    expect(statusOf(res)).toBe(200);
    expect(parseWebhook).not.toHaveBeenCalled();
  });

  it("invokes parseWebhook with a valid object body", async () => {
    parseWebhook.mockReturnValue([{ eventType: "x", providerUserId: "1", workoutId: "9" }]);
    handle.mockResolvedValue(undefined);
    const res = await call({ event_type: "x" });
    expect(statusOf(res)).toBe(200);
    expect(parseWebhook).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledTimes(1);
  });
});
