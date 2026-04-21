import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./sessions.ts", () => ({
  getSession: vi.fn(),
}));

import { requireSession } from "./require-session.ts";
import { getSession } from "./sessions.ts";

const mockedGetSession = vi.mocked(getSession);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireSession", () => {
  it("returns the session when it exists and is open", async () => {
    mockedGetSession.mockResolvedValueOnce({ id: "abc" } as never);
    const result = await requireSession("abc");
    expect(result).toEqual({ id: "abc" });
    expect(mockedGetSession).toHaveBeenCalledWith("abc");
  });

  it("returns 401 when the id is missing", async () => {
    const result = await requireSession(undefined);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    expect(mockedGetSession).not.toHaveBeenCalled();
  });

  it("returns 401 for empty-string id (doesn't look it up)", async () => {
    const result = await requireSession("");
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    expect(mockedGetSession).not.toHaveBeenCalled();
  });

  it("returns 401 for a non-string id", async () => {
    const result = await requireSession(null);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    expect(mockedGetSession).not.toHaveBeenCalled();
  });

  it("returns 401 when the session doesn't exist (or is closed)", async () => {
    mockedGetSession.mockResolvedValueOnce(undefined);
    const result = await requireSession("nonexistent");
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });
});
