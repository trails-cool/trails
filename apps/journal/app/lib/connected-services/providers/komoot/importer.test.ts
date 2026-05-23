import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only deps before import
vi.mock("../../../crypto.server.ts", () => ({
  decrypt: vi.fn((s: string) => `decrypted:${s}`),
  encrypt: vi.fn((s: string) => `encrypted:${s}`),
}));

vi.mock("../../../komoot.server.ts", () => ({
  fetchKomootTours: vi.fn(),
  fetchKomootTourGpx: vi.fn(),
}));

vi.mock("../../../sync/imports.server.ts", () => ({
  isAlreadyImported: vi.fn(),
  importActivity: vi.fn(),
  recordImport: vi.fn(),
}));

vi.mock("../../manager.ts", () => ({
  getServiceById: vi.fn(),
}));

import { komootImporter } from "./importer.ts";
import { fetchKomootTours, fetchKomootTourGpx } from "../../../komoot.server.ts";
import { isAlreadyImported, importActivity } from "../../../sync/imports.server.ts";
import { getServiceById } from "../../manager.ts";

const mockFetchTours = vi.mocked(fetchKomootTours);
const mockFetchGpx = vi.mocked(fetchKomootTourGpx);
const mockIsAlreadyImported = vi.mocked(isAlreadyImported);
const mockImportActivity = vi.mocked(importActivity);
const mockGetServiceById = vi.mocked(getServiceById);

function makeCtx(creds: unknown, serviceId = "svc-1") {
  return {
    serviceId,
    withFreshCredentials: async <T>(fn: (c: unknown) => Promise<T>) => fn(creds),
  };
}

describe("komootImporter.listImportable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists public tours without auth token", async () => {
    mockFetchTours.mockResolvedValueOnce({
      tours: [
        { id: "111", name: "Morning ride", sport: "bike", date: "2024-01-01T00:00:00Z", distance: 30000, duration: 5400, elevationUp: 200, elevationDown: 190 },
      ],
      totalPages: 1,
    });

    const ctx = makeCtx({ mode: "public", komootUserId: "999" });
    const result = await komootImporter.listImportable(ctx, 1);

    expect(mockFetchTours).toHaveBeenCalledWith("999", 1, undefined);
    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0]!.id).toBe("111");
  });

  it("passes basic auth token for authenticated mode", async () => {
    mockFetchTours.mockResolvedValueOnce({ tours: [], totalPages: 1 });

    const ctx = makeCtx({
      mode: "authenticated",
      email: "test@example.com",
      encryptedPassword: "enc-pw",
      komootUserId: "888",
    });
    await komootImporter.listImportable(ctx, 1);

    // decrypt returns `decrypted:enc-pw`, so basic token = base64(test@example.com:decrypted:enc-pw)
    const expectedToken = Buffer.from("test@example.com:decrypted:enc-pw").toString("base64");
    expect(mockFetchTours).toHaveBeenCalledWith("888", 1, expectedToken);
  });
});

describe("komootImporter.importOne", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServiceById.mockResolvedValue({
      id: "svc-1",
      userId: "user-1",
      provider: "komoot",
      credentialKind: "public",
      credentials: { mode: "public", komootUserId: "999" },
      status: "active",
      providerUserId: "999",
      grantedScopes: [],
      createdAt: new Date(),
    });
    mockIsAlreadyImported.mockResolvedValue(false);
    mockImportActivity.mockResolvedValue({ activityId: "act-123" });
    mockFetchTours.mockResolvedValue({ tours: [{ id: "tour-1", name: "Test Tour", sport: "hike", date: "2024-01-01T00:00:00Z", distance: 10000, duration: 3600, elevationUp: 100, elevationDown: 100 }], totalPages: 1 });
    mockFetchGpx.mockResolvedValue("<gpx>...</gpx>");
  });

  it("imports a tour with GPX", async () => {
    const ctx = makeCtx({ mode: "public", komootUserId: "999" });
    const result = await komootImporter.importOne(ctx, "tour-1");

    expect(result.activityId).toBe("act-123");
    expect(result.hadGeometry).toBe(true);
    expect(mockImportActivity).toHaveBeenCalledWith("user-1", "komoot", "tour-1", {
      name: "Test Tour",
      gpx: "<gpx>...</gpx>",
    });
  });

  it("throws when tour is already imported", async () => {
    mockIsAlreadyImported.mockResolvedValue(true);
    const ctx = makeCtx({ mode: "public", komootUserId: "999" });
    await expect(komootImporter.importOne(ctx, "tour-1")).rejects.toThrow("already imported");
  });

  it("imports without geometry when GPX fetch fails", async () => {
    mockFetchGpx.mockRejectedValue(new Error("404"));
    const ctx = makeCtx({ mode: "public", komootUserId: "999" });
    const result = await komootImporter.importOne(ctx, "tour-1");
    expect(result.hadGeometry).toBe(false);
    expect(mockImportActivity).toHaveBeenCalledWith("user-1", "komoot", "tour-1", {
      name: "Test Tour",
      gpx: undefined,
    });
  });
});
