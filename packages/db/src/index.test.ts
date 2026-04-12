import { describe, it, expect, vi } from "vitest";
import { withDb } from "./index.ts";

describe("withDb", () => {
  it("returns the handler result on success", async () => {
    const result = await withDb(async () => "ok");
    expect(result).toBe("ok");
  });

  it("throws 503 Response on database errors", async () => {
    try {
      await withDb(async () => {
        throw new Error("connection refused");
      });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      expect((err as Response).status).toBe(503);
    }
  });

  it("re-throws Response instances (redirects)", async () => {
    const redirect = new Response(null, { status: 302 });
    try {
      await withDb(async () => {
        throw redirect;
      });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBe(redirect);
      expect((err as Response).status).toBe(302);
    }
  });

  it("re-throws DataWithResponseInit errors", async () => {
    const dataError = { type: "DataWithResponseInit", data: "test", init: {} };
    try {
      await withDb(async () => {
        throw dataError;
      });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBe(dataError);
    }
  });

  it("logs database errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await withDb(async () => {
        throw new Error("timeout");
      });
    } catch {
      // expected
    }
    expect(spy).toHaveBeenCalledWith("[withDb] Database error:", "timeout");
    spy.mockRestore();
  });
});
