// Contract tests for the Wahoo WebhookReceiver capability adapter.
//
// Seam: parseWebhook(body) -> WebhookEvent | null
//       handle(event) -> void  (creates an activity if file present, dedups via sync_imports)

import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchSpy = vi.fn();
const mockCreateActivity = vi.fn();
const mockIsAlreadyImported = vi.fn();
const mockRecordImport = vi.fn();
const mockGetServiceByProviderUser = vi.fn();
const mockWithFreshCredentials = vi.fn();

vi.mock("../../../activities.server.ts", () => ({
  createActivity: mockCreateActivity,
}));
vi.mock("../../../sync/imports.server.ts", () => ({
  isAlreadyImported: mockIsAlreadyImported,
  recordImport: mockRecordImport,
}));
vi.mock("../../manager.ts", () => ({
  getServiceByProviderUser: mockGetServiceByProviderUser,
  withFreshCredentials: mockWithFreshCredentials,
}));

beforeEach(() => {
  fetchSpy.mockReset();
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
  mockCreateActivity.mockReset();
  mockIsAlreadyImported.mockReset();
  mockRecordImport.mockReset();
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
    expect(event).toEqual({
      eventType: "workout_summary",
      providerUserId: "7",
      workoutId: "42",
      fileUrl: "https://cdn.example/42.fit",
    });
  });

  it("returns null for unrecognized event types", () => {
    expect(wahooWebhook.parseWebhook({ event_type: "other" })).toBeNull();
  });

  it("returns null when user.id is missing", () => {
    expect(
      wahooWebhook.parseWebhook({ event_type: "workout_summary", user: {} }),
    ).toBeNull();
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
    mockCreateActivity.mockResolvedValue("act-1");
    // withFreshCredentials passes the credentials to fn — we don't need to
    // download a file to assert the basic flow; pass a no-op file URL test
    // via parseWebhook output containing fileUrl undefined to skip download.
    mockWithFreshCredentials.mockImplementation(
      async (_id: string, fn: (creds: unknown) => Promise<unknown>) =>
        fn({
          access_token: "a",
          refresh_token: "r",
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        }),
    );

    await wahooWebhook.handle({
      eventType: "workout_summary",
      providerUserId: "7",
      workoutId: "42",
      // no fileUrl — the activity is created without GPX
    });

    expect(mockCreateActivity).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ name: expect.stringContaining("Wahoo") }),
    );
    expect(mockRecordImport).toHaveBeenCalledWith("u1", "wahoo", "42", "act-1");
  });

  it("silently skips when the providerUserId is unknown (no leak)", async () => {
    mockGetServiceByProviderUser.mockResolvedValue(null);

    await wahooWebhook.handle({
      eventType: "workout_summary",
      providerUserId: "999",
      workoutId: "42",
    });

    expect(mockCreateActivity).not.toHaveBeenCalled();
    expect(mockRecordImport).not.toHaveBeenCalled();
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

    expect(mockCreateActivity).not.toHaveBeenCalled();
    expect(mockRecordImport).not.toHaveBeenCalled();
  });
});
