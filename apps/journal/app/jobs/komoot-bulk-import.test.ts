import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/logger.server.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const withFreshCredentials = vi.fn();
vi.mock("../lib/connected-services/manager.ts", () => ({
  withFreshCredentials: (...args: unknown[]) => withFreshCredentials(...args),
}));

const runKomootBulkImport = vi.fn();
const markBatchFailed = vi.fn();
vi.mock("../lib/komoot-bulk-import.server.ts", () => ({
  runKomootBulkImport: (...args: unknown[]) => runKomootBulkImport(...args),
  markBatchFailed: (...args: unknown[]) => markBatchFailed(...args),
}));

import { komootBulkImportJob } from "./komoot-bulk-import.ts";

type HandlerJobs = Parameters<typeof komootBulkImportJob.handler>[0];

function jobWith(data: unknown): HandlerJobs {
  return [{ id: "j1", data }] as unknown as HandlerJobs;
}

const PAYLOAD = { batchId: "batch-1", userId: "user-1", serviceId: "svc-1" };

describe("komoot-bulk-import job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves credentials through the manager — only the serviceId crosses the queue", async () => {
    const creds = { mode: "public", komootUserId: "k1" };
    withFreshCredentials.mockImplementation(async (_serviceId, fn) => fn(creds));
    runKomootBulkImport.mockResolvedValue(undefined);

    await komootBulkImportJob.handler(jobWith(PAYLOAD));

    expect(withFreshCredentials).toHaveBeenCalledWith("svc-1", expect.any(Function));
    expect(runKomootBulkImport).toHaveBeenCalledWith("batch-1", "user-1", creds);
    expect(markBatchFailed).not.toHaveBeenCalled();
  });

  it("marks the batch failed and rethrows when credential resolution fails", async () => {
    withFreshCredentials.mockRejectedValue(new Error("needs relink"));

    await expect(komootBulkImportJob.handler(jobWith(PAYLOAD))).rejects.toThrow("needs relink");

    expect(runKomootBulkImport).not.toHaveBeenCalled();
    expect(markBatchFailed).toHaveBeenCalledWith("batch-1", "needs relink");
  });

  it("also marks failed when the import itself rejects (markBatchFailed is a no-op on terminal batches)", async () => {
    withFreshCredentials.mockImplementation(async (_serviceId, fn) => fn({ mode: "public" }));
    runKomootBulkImport.mockRejectedValue(new Error("komoot 500"));

    await expect(komootBulkImportJob.handler(jobWith(PAYLOAD))).rejects.toThrow("komoot 500");
    expect(markBatchFailed).toHaveBeenCalledWith("batch-1", "komoot 500");
  });
});
