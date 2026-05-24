// Contract tests for the Wahoo Importer capability adapter.
//
// The seam under test is `Importer` from registry.ts:
//   listImportable(ctx, page) -> ImportableList
//   importOne(ctx, workoutId) -> ImportResult
//
// Internals (FIT parsing, Wahoo HTTP details) are tested via the legacy
// wahoo.test.ts and follow the code as it's reorganized.

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CapabilityContext } from "../../registry.ts";
import type { OAuthCredentials } from "../../types.ts";

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
});

const stubCreds: OAuthCredentials = {
  access_token: "fake-token",
  refresh_token: "rt",
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
};

function ctxWith(creds: OAuthCredentials = stubCreds): CapabilityContext {
  return {
    serviceId: "svc-1",
    withFreshCredentials: async (fn) => fn(creds),
  };
}

// Importer is loaded after the implementation file exists. Using a dynamic
// import isolates the test from module load order during initial red.
const { wahooImporter } = await import("./importer.ts");

describe("wahooImporter.listImportable", () => {
  it("calls Wahoo /v1/workouts with the access token from withFreshCredentials", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          workouts: [
            {
              id: 42,
              name: "Morning ride",
              workout_type: "biking",
              starts: "2026-05-01T07:00:00Z",
              workout_summary: {
                duration_active_accum: 3600,
                distance_accum: 25000,
                file: { url: "https://cdn.example/42.fit" },
              },
            },
          ],
          total: 1,
          page: 1,
          per_page: 30,
        }),
        { status: 200 },
      ),
    );

    const result = await wahooImporter.listImportable(ctxWith(), 1);

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain("/v1/workouts");
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe(
      "Bearer fake-token",
    );
    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0]!.id).toBe("42");
    expect(result.workouts[0]!.fileUrl).toBe("https://cdn.example/42.fit");
    expect(result.total).toBe(1);
  });

  it("filters out third-party workouts (fitness_app_id >= 1000)", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          workouts: [
            { id: 1, name: "Wahoo native", workout_type: "biking", starts: "2026-05-01T07:00:00Z" },
            {
              id: 2,
              name: "Third-party",
              workout_type: "biking",
              starts: "2026-05-01T08:00:00Z",
              fitness_app_id: 1234,
            },
          ],
          total: 2,
          page: 1,
          per_page: 30,
        }),
        { status: 200 },
      ),
    );

    const result = await wahooImporter.listImportable(ctxWith(), 1);
    expect(result.workouts.map((w) => w.id)).toEqual(["1"]);
  });
});

describe("wahooImporter.importOne pagination", () => {
  function fitToGpxMock() {
    // The importer calls fitToGpx — short-circuit it so the test focuses
    // on pagination, not FIT parsing.
    return Promise.resolve("<gpx></gpx>");
  }

  it("paginates past page 1 until it finds the target workout", async () => {
    vi.resetModules();
    vi.doMock("../../fit.ts", () => ({ fitToGpx: fitToGpxMock }));
    vi.doMock("../../../sync/imports.server.ts", () => ({
      importActivity: vi.fn().mockResolvedValue({ activityId: "a-1" }),
      isAlreadyImported: vi.fn().mockResolvedValue(false),
    }));
    vi.doMock("../../manager.ts", () => ({
      getServiceById: vi.fn().mockResolvedValue({ id: "svc-1", userId: "u-1" }),
    }));

    // Page 1: workouts 1..30, Page 2: workouts 31..50 (the target = 42)
    fetchSpy.mockImplementation((url) => {
      const u = String(url);
      if (u.includes("page=2")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              workouts: [
                {
                  id: 42,
                  name: "Old ride",
                  workout_type: "biking",
                  starts: "2025-12-01T07:00:00Z",
                  workout_summary: { file: { url: "https://cdn.example/42.fit" } },
                },
              ],
              total: 50,
              page: 2,
              per_page: 30,
            }),
            { status: 200 },
          ),
        );
      }
      if (u.includes("/42.fit")) {
        return Promise.resolve(new Response(new ArrayBuffer(4), { status: 200 }));
      }
      // page 1 by default — does NOT contain id 42
      return Promise.resolve(
        new Response(
          JSON.stringify({
            workouts: [
              { id: 1, name: "Recent", workout_type: "biking", starts: "2026-05-01T07:00:00Z" },
            ],
            total: 50,
            page: 1,
            per_page: 30,
          }),
          { status: 200 },
        ),
      );
    });

    const { wahooImporter } = await import("./importer.ts");
    const result = await wahooImporter.importOne(ctxWith(), "42");
    expect(result.activityId).toBe("a-1");
    // Fetched at least pages 1 and 2 of the /v1/workouts endpoint
    const workoutCalls = fetchSpy.mock.calls.filter(([u]) =>
      String(u).includes("/v1/workouts?"),
    );
    expect(workoutCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("throws a clear error when the workout is not found on any page", async () => {
    vi.resetModules();
    vi.doMock("../../fit.ts", () => ({ fitToGpx: fitToGpxMock }));
    vi.doMock("../../../sync/imports.server.ts", () => ({
      importActivity: vi.fn(),
      isAlreadyImported: vi.fn().mockResolvedValue(false),
    }));
    vi.doMock("../../manager.ts", () => ({
      getServiceById: vi.fn().mockResolvedValue({ id: "svc-1", userId: "u-1" }),
    }));

    fetchSpy.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            workouts: [
              { id: 1, name: "Recent", workout_type: "biking", starts: "2026-05-01T07:00:00Z" },
            ],
            total: 1,
            page: 1,
            per_page: 30,
          }),
          { status: 200 },
        ),
      ),
    );

    const { wahooImporter } = await import("./importer.ts");
    await expect(wahooImporter.importOne(ctxWith(), "999")).rejects.toThrow(/not found/);
  });
});
