import { describe, it, expect, vi, beforeEach } from "vitest";
import { startWorker } from "./worker.ts";
import type { JobDefinition } from "./types.ts";

function createMockBoss() {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    schedule: vi.fn().mockResolvedValue(undefined),
    work: vi.fn().mockResolvedValue("worker-id"),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("startWorker", () => {
  it("starts the boss instance", async () => {
    const boss = createMockBoss();
    await startWorker(boss as never, []);
    expect(boss.start).toHaveBeenCalled();
  });

  it("registers job handlers", async () => {
    const boss = createMockBoss();
    const handler = vi.fn();
    const jobs: JobDefinition[] = [{ name: "test-job", handler }];

    await startWorker(boss as never, jobs);

    expect(boss.work).toHaveBeenCalledWith("test-job", handler);
  });

  it("schedules cron jobs with options", async () => {
    const boss = createMockBoss();
    const handler = vi.fn();
    const jobs: JobDefinition[] = [
      {
        name: "cron-job",
        handler,
        cron: "0 * * * *",
        retryLimit: 3,
        expireInSeconds: 120,
      },
    ];

    await startWorker(boss as never, jobs);

    expect(boss.schedule).toHaveBeenCalledWith("cron-job", "0 * * * *", undefined, {
      retryLimit: 3,
      expireInSeconds: 120,
    });
    expect(boss.work).toHaveBeenCalledWith("cron-job", handler);
  });

  it("does not schedule non-cron jobs", async () => {
    const boss = createMockBoss();
    const jobs: JobDefinition[] = [{ name: "one-shot", handler: vi.fn() }];

    await startWorker(boss as never, jobs);

    expect(boss.schedule).not.toHaveBeenCalled();
    expect(boss.work).toHaveBeenCalledWith("one-shot", jobs[0]!.handler);
  });

  it("registers multiple jobs", async () => {
    const boss = createMockBoss();
    const jobs: JobDefinition[] = [
      { name: "job-a", handler: vi.fn() },
      { name: "job-b", handler: vi.fn(), cron: "*/5 * * * *" },
    ];

    await startWorker(boss as never, jobs);

    expect(boss.work).toHaveBeenCalledTimes(2);
    expect(boss.schedule).toHaveBeenCalledTimes(1);
  });
});
