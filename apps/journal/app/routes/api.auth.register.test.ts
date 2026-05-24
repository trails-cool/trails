import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  startRegistration: vi.fn(),
  finishRegistration: vi.fn(),
  registerWithMagicLink: vi.fn(),
  addPasskeyStart: vi.fn(),
  addPasskeyFinish: vi.fn(),
  sendMagicLink: vi.fn(),
  enqueueOptional: vi.fn(),
  completeAuth: vi.fn(),
}));
const {
  startRegistration,
  finishRegistration,
  registerWithMagicLink,
  addPasskeyStart,
  addPasskeyFinish,
  sendMagicLink,
  enqueueOptional,
  completeAuth,
} = mocks;

vi.mock("~/lib/auth.server", () => ({
  startRegistration: mocks.startRegistration,
  finishRegistration: mocks.finishRegistration,
  registerWithMagicLink: mocks.registerWithMagicLink,
  addPasskeyStart: mocks.addPasskeyStart,
  addPasskeyFinish: mocks.addPasskeyFinish,
}));
vi.mock("~/lib/auth/completion.server", () => ({ completeAuth: mocks.completeAuth }));
vi.mock("~/lib/email.server", () => ({ sendMagicLink: mocks.sendMagicLink }));
vi.mock("~/lib/boss.server", () => ({ enqueueOptional: mocks.enqueueOptional }));

import { action } from "./api.auth.register.ts";

function makeRequest(body: unknown): Request {
  return new Request("http://test.local/api/auth/register", {
    method: "POST",
    body: typeof body === "string" ? (body as string) : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

async function callAction(body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await action({
    request: makeRequest(body),
    params: {},
    context: {} as unknown,
  } as never);
  if (res instanceof Response) {
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  }
  const d = res as { data: Record<string, unknown>; init?: { status?: number } };
  return { status: d.init?.status ?? 200, json: d.data };
}

describe("POST /api/auth/register — input validation", () => {
  beforeEach(() => {
    startRegistration.mockReset();
    finishRegistration.mockReset();
    registerWithMagicLink.mockReset();
    addPasskeyStart.mockReset();
    addPasskeyFinish.mockReset();
    sendMagicLink.mockReset();
    enqueueOptional.mockReset();
    completeAuth.mockReset();
  });

  it("rejects malformed JSON with 400", async () => {
    const { status, json } = await callAction("not-json{");
    expect(status).toBe(400);
    expect(json.error).toMatch(/Invalid JSON/);
    expect(startRegistration).not.toHaveBeenCalled();
  });

  it("rejects unknown step with 400", async () => {
    const { status } = await callAction({ step: "bogus" });
    expect(status).toBe(400);
    expect(startRegistration).not.toHaveBeenCalled();
  });

  it("rejects non-string email with 400 (zod type check)", async () => {
    const { status } = await callAction({
      step: "start",
      email: 12345,
      username: "alice",
      termsAccepted: true,
      termsVersion: "v1",
    });
    expect(status).toBe(400);
    expect(startRegistration).not.toHaveBeenCalled();
  });

  it("rejects start without termsAccepted with 400", async () => {
    const { status, json } = await callAction({
      step: "start",
      email: "a@b.co",
      username: "alice",
    });
    expect(status).toBe(400);
    expect(json.error).toMatch(/Terms of Service/);
    expect(startRegistration).not.toHaveBeenCalled();
  });

  it("rejects start without email with a missing-field error", async () => {
    const { status, json } = await callAction({
      step: "start",
      username: "alice",
      termsAccepted: true,
      termsVersion: "v1",
    });
    expect(status).toBe(400);
    expect(json.error).toMatch(/email/i);
  });

  it("accepts a well-formed start payload and calls downstream", async () => {
    startRegistration.mockResolvedValue({ options: { foo: 1 }, userId: "u1" });
    const { status, json } = await callAction({
      step: "start",
      email: "a@b.co",
      username: "alice",
      termsAccepted: true,
      termsVersion: "v1",
    });
    expect(status).toBe(200);
    expect(json.step).toBe("challenge");
    expect(startRegistration).toHaveBeenCalledWith("a@b.co", "alice");
  });

  it("enqueues welcome email job on finish (no fire-and-forget)", async () => {
    finishRegistration.mockResolvedValue("new-user-id");
    completeAuth.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { status } = await callAction({
      step: "finish",
      userId: "u1",
      email: "a@b.co",
      username: "alice",
      challenge: "chal",
      response: { id: "x" },
      termsAccepted: true,
      termsVersion: "v1",
    });
    expect(status).toBe(200);
    expect(enqueueOptional).toHaveBeenCalledWith(
      "send-welcome-email",
      { email: "a@b.co", username: "alice" },
      expect.objectContaining({ source: "register" }),
    );
  });
});
