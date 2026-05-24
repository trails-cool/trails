import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("../db.ts", () => ({ getDb: mocks.getDb }));

import {
  requireSessionUser,
  requireSessionUserJson,
  sessionStorage,
} from "./session.server.ts";

async function requestWithSession(userId: string | null): Promise<Request> {
  const session = await sessionStorage.getSession();
  if (userId) session.set("userId", userId);
  const cookie = await sessionStorage.commitSession(session);
  return new Request("http://test.local/", {
    headers: { cookie },
  });
}

describe("requireSessionUser", () => {
  beforeEach(() => {
    mocks.getDb.mockReset();
  });

  it("throws a redirect to /auth/login when no session cookie", async () => {
    const req = new Request("http://test.local/");
    try {
      await requireSessionUser(req);
      throw new Error("should have thrown");
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(Response);
      const resp = thrown as Response;
      expect(resp.status).toBe(302);
      expect(resp.headers.get("location")).toBe("/auth/login");
    }
  });

  it("throws a redirect when session userId points at a missing user", async () => {
    mocks.getDb.mockReturnValue({
      select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
    });
    const req = await requestWithSession("ghost-user");
    try {
      await requireSessionUser(req);
      throw new Error("should have thrown");
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(Response);
      expect((thrown as Response).headers.get("location")).toBe("/auth/login");
    }
  });

  it("returns the user when the session is valid", async () => {
    const user = { id: "u1", username: "alice" };
    mocks.getDb.mockReturnValue({
      select: () => ({ from: () => ({ where: () => Promise.resolve([user]) }) }),
    });
    const req = await requestWithSession("u1");
    const result = await requireSessionUser(req);
    expect(result).toEqual(user);
  });
});

describe("requireSessionUserJson", () => {
  beforeEach(() => {
    mocks.getDb.mockReset();
  });

  it("throws a 401 JSON Response when unauthenticated", async () => {
    const req = new Request("http://test.local/");
    try {
      await requireSessionUserJson(req);
      throw new Error("should have thrown");
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(Response);
      const resp = thrown as Response;
      expect(resp.status).toBe(401);
      const body = (await resp.json()) as { error: string };
      expect(body.error).toBe("Unauthorized");
    }
  });
});
