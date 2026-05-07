import { describe, it, expect, vi, beforeEach } from "vitest";
import { TERMS_VERSION } from "./legal";

const mockGetAuthenticatedUser = vi.fn();

vi.mock("./oauth.server.ts", () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireApiUser", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);
    const { requireApiUser } = await import("./api-guard.server.ts");

    try {
      await requireApiUser(new Request("http://localhost/api/v1/routes"));
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      expect((err as Response).status).toBe(401);
      const body = await (err as Response).json();
      expect(body.code).toBe("UNAUTHORIZED");
    }
  });

  it("returns the user when termsVersion matches", async () => {
    const user = { id: "u1", termsVersion: TERMS_VERSION };
    mockGetAuthenticatedUser.mockResolvedValue(user);
    const { requireApiUser } = await import("./api-guard.server.ts");

    const result = await requireApiUser(new Request("http://localhost/api/v1/routes"));
    expect(result).toBe(user);
  });

  it("returns 403 TERMS_OUTDATED when termsVersion is stale", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1", termsVersion: "2020-01-01" });
    const { requireApiUser } = await import("./api-guard.server.ts");

    try {
      await requireApiUser(new Request("http://localhost/api/v1/routes"));
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      expect((err as Response).status).toBe(403);
      const body = await (err as Response).json();
      expect(body.code).toBe("TERMS_OUTDATED");
      expect(body.currentTermsVersion).toBe(TERMS_VERSION);
    }
  });

  it("returns 403 TERMS_OUTDATED when termsVersion is null", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1", termsVersion: null });
    const { requireApiUser } = await import("./api-guard.server.ts");

    try {
      await requireApiUser(new Request("http://localhost/api/v1/routes"));
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      expect((err as Response).status).toBe(403);
      const body = await (err as Response).json();
      expect(body.code).toBe("TERMS_OUTDATED");
      expect(body.currentTermsVersion).toBe(TERMS_VERSION);
    }
  });
});
