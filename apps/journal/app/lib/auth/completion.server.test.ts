// Contract tests for the completeAuth chokepoint. See ADR-0004 +
// docs/adr/0005-no-authmethod-polymorphism.md for why this exists.

import { describe, it, expect } from "vitest";
import { completeAuth } from "./completion.server.ts";

function reqWith(headers: Record<string, string> = {}) {
  return new Request("https://localhost/whatever", { headers });
}

describe("completeAuth (mode=redirect)", () => {
  it("redirects to returnTo when it's a same-origin path", async () => {
    const res = await completeAuth({
      userId: "u1",
      request: reqWith(),
      returnTo: "/profile",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/profile");
  });

  it("redirects to / when returnTo is missing", async () => {
    const res = await completeAuth({ userId: "u1", request: reqWith() });
    expect(res.headers.get("Location")).toBe("/");
  });

  it("redirects to / when returnTo is null", async () => {
    const res = await completeAuth({
      userId: "u1",
      request: reqWith(),
      returnTo: null,
    });
    expect(res.headers.get("Location")).toBe("/");
  });

  it("rejects protocol-relative returnTo (//evil.com/x) → /", async () => {
    const res = await completeAuth({
      userId: "u1",
      request: reqWith(),
      returnTo: "//evil.com/x",
    });
    expect(res.headers.get("Location")).toBe("/");
  });

  it("rejects absolute-URL returnTo (https://evil.com) → /", async () => {
    const res = await completeAuth({
      userId: "u1",
      request: reqWith(),
      returnTo: "https://evil.com",
    });
    expect(res.headers.get("Location")).toBe("/");
  });

  it("rejects returnTo that doesn't start with / → /", async () => {
    const res = await completeAuth({
      userId: "u1",
      request: reqWith(),
      returnTo: "javascript:alert(1)",
    });
    expect(res.headers.get("Location")).toBe("/");
  });

  it("attaches a __session Set-Cookie carrying the userId", async () => {
    const res = await completeAuth({
      userId: "u1",
      request: reqWith(),
      returnTo: "/",
    });
    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).not.toBeNull();
    expect(setCookie!).toMatch(/^__session=/);
    // HttpOnly is required for a session cookie.
    expect(setCookie!.toLowerCase()).toContain("httponly");
  });
});

describe("completeAuth (mode=json)", () => {
  it("returns 200 JSON with sanitized redirectTo and Set-Cookie", async () => {
    const res = await completeAuth({
      userId: "u1",
      request: reqWith(),
      returnTo: "/profile",
      mode: "json",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Set-Cookie")).toMatch(/^__session=/);
    const body = (await res.json()) as { ok: boolean; step: string; redirectTo: string };
    expect(body).toEqual({ ok: true, step: "done", redirectTo: "/profile" });
  });

  it("falls back to / when returnTo is unsafe (json mode)", async () => {
    const res = await completeAuth({
      userId: "u1",
      request: reqWith(),
      returnTo: "https://evil.com",
      mode: "json",
    });
    const body = (await res.json()) as { ok: boolean; redirectTo: string };
    expect(body.redirectTo).toBe("/");
  });

  it("redirectTo defaults to / when no returnTo (json mode)", async () => {
    const res = await completeAuth({
      userId: "u1",
      request: reqWith(),
      mode: "json",
    });
    const body = (await res.json()) as { ok: boolean; redirectTo: string };
    expect(body.redirectTo).toBe("/");
  });
});
