import { describe, it, expect, vi, beforeEach } from "vitest";
import { assertValidJobName, startWorker } from "./worker.ts";
import type { JobDefinition } from "./types.ts";

function createMockBoss() {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    createQueue: vi.fn().mockResolvedValue(undefined),
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

  it("creates queues before registering handlers", async () => {
    const boss = createMockBoss();
    const jobs: JobDefinition[] = [{ name: "test-job", handler: vi.fn() }];

    await startWorker(boss as never, jobs);

    expect(boss.createQueue).toHaveBeenCalledWith("test-job");
    expect(boss.createQueue).toHaveBeenCalledBefore(boss.work);
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

  it("rejects queue names with characters that pg-boss v11+ forbids", async () => {
    const boss = createMockBoss();
    // `:` was allowed by pg-boss v10 and got us into trouble on upgrade
    // (our queues were named demo-bot:generate / demo-bot:prune until we
    // renamed them for v11+). Regression-guard that shape.
    const jobs: JobDefinition[] = [{ name: "demo-bot:generate", handler: vi.fn() }];

    await expect(startWorker(boss as never, jobs)).rejects.toThrow(
      /Invalid pg-boss queue name/,
    );
    // start/createQueue/schedule/work must not have been called — we
    // fail before any side effects.
    expect(boss.start).not.toHaveBeenCalled();
    expect(boss.createQueue).not.toHaveBeenCalled();
    expect(boss.schedule).not.toHaveBeenCalled();
    expect(boss.work).not.toHaveBeenCalled();
  });
});

describe("assertValidJobName", () => {
  it("accepts letters, numbers, hyphens, underscores, and periods", () => {
    for (const name of [
      "demo-bot-generate",
      "expire_sessions",
      "job.v2",
      "DemoBot123",
      "a",
    ]) {
      expect(() => assertValidJobName(name)).not.toThrow();
    }
  });

  it("rejects colon, slash, whitespace, and other punctuation", () => {
    for (const name of [
      "demo-bot:generate",
      "foo/bar",
      "foo bar",
      "foo@bar",
      "foo#bar",
      "",
    ]) {
      expect(() => assertValidJobName(name)).toThrow(/Invalid pg-boss queue name/);
    }
  });
});
