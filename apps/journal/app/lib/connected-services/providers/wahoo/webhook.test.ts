// Contract tests for the Wahoo WebhookReceiver capability adapter.
//
// Seam: parseWebhook(body) -> WebhookEvent[] (empty = nothing actionable)
//       handle(event) -> void  (creates an activity if file present, dedups via sync_imports)

import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchSpy = vi.fn();
const mockImportActivity = vi.fn();
const mockIsAlreadyImported = vi.fn();
const mockGetServiceByProviderUser = vi.fn();
const mockWithFreshCredentials = vi.fn();

vi.mock("../../../sync/imports.server.ts", () => ({
  isAlreadyImported: mockIsAlreadyImported,
  importActivity: mockImportActivity,
}));
vi.mock("../../manager.ts", () => ({
  getServiceByProviderUser: mockGetServiceByProviderUser,
  withFreshCredentials: mockWithFreshCredentials,
}));

beforeEach(() => {
  fetchSpy.mockReset();
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
  mockImportActivity.mockReset();
  mockIsAlreadyImported.mockReset();
  mockGetServiceByProviderUser.mockReset();
  mockWithFreshCredentials.mockReset();
});

const { wahooWebhook } = await import("./webhook.ts");

describe("wahooWebhook.parseWebhook", () => {
  it("returns a WebhookEvent for workout_summary payloads", () => {
    const event = wahooWebhook.parseWebhook({
      event_type: "workout_summary",
      user: { id: 7 },
      workout_summary: {
        workout: { id: 42 },
        file: { url: "https://cdn.example/42.fit" },
      },
    });
    expect(event).toEqual([
      {
        eventType: "workout_summary",
        providerUserId: "7",
        workoutId: "42",
        fileUrl: "https://cdn.example/42.fit",
      },
    ]);
  });

  it("returns no events for unrecognized event types", () => {
    expect(wahooWebhook.parseWebhook({ event_type: "other" })).toEqual([]);
  });

  it("returns no events when user.id is missing", () => {
    expect(
      wahooWebhook.parseWebhook({ event_type: "workout_summary", user: {} }),
    ).toEqual([]);
  });
});

describe("wahooWebhook.handle", () => {
  it("creates an activity and records the import for a known user", async () => {
    mockGetServiceByProviderUser.mockResolvedValue({
      id: "svc-1",
      userId: "u1",
      provider: "wahoo",
    });
    mockIsAlreadyImported.mockResolvedValue(false);
    mockImportActivity.mockResolvedValue({ activityId: "act-1" });

    await wahooWebhook.handle({
      eventType: "workout_summary",
      providerUserId: "7",
      workoutId: "42",
      // no fileUrl — the activity is created without GPX
    });

    expect(mockImportActivity).toHaveBeenCalledWith(
      "u1",
      "wahoo",
      "42",
      expect.objectContaining({ name: expect.stringContaining("Wahoo") }),
    );
  });

  it("silently skips when the providerUserId is unknown (no leak)", async () => {
    mockGetServiceByProviderUser.mockResolvedValue(null);

    await wahooWebhook.handle({
      eventType: "workout_summary",
      providerUserId: "999",
      workoutId: "42",
    });

    expect(mockImportActivity).not.toHaveBeenCalled();
  });

  it("silently skips when the workout was already imported (idempotency)", async () => {
    mockGetServiceByProviderUser.mockResolvedValue({
      id: "svc-1",
      userId: "u1",
      provider: "wahoo",
    });
    mockIsAlreadyImported.mockResolvedValue(true);

    await wahooWebhook.handle({
      eventType: "workout_summary",
      providerUserId: "7",
      workoutId: "42",
    });

    expect(mockImportActivity).not.toHaveBeenCalled();
  });
});
