import { describe, it, expect, vi } from "vitest";

vi.mock("../lib/sessions.ts", () => ({
  expireSessions: vi.fn().mockResolvedValue(5),
}));

vi.mock("../lib/logger.server.ts", () => ({
  logger: { info: vi.fn() },
}));

describe("expireSessionsJob", () => {
  it("calls expireSessions with 7-day TTL and returns count", async () => {
    const { expireSessionsJob } = await import("./expire-sessions.ts");
    const { expireSessions } = await import("../lib/sessions.ts");

    const result = await expireSessionsJob.handler({ id: "test", name: "expire-sessions", data: {} } as never);

    expect(expireSessions).toHaveBeenCalledWith(7);
    expect(result).toEqual({ expiredCount: 5 });
  });

  it("has correct job configuration", async () => {
    const { expireSessionsJob } = await import("./expire-sessions.ts");

    expect(expireSessionsJob.name).toBe("expire-sessions");
    expect(expireSessionsJob.cron).toBe("0 * * * *");
    expect(expireSessionsJob.retryLimit).toBe(2);
    expect(expireSessionsJob.expireInSeconds).toBe(60);
  });
});
