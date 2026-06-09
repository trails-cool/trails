// Contract tests for the Garmin WebhookReceiver (spec: garmin-import).
//
// Seam: parseWebhook(body) -> WebhookEvent[] (Garmin batches notifications)
//       handle(event) -> void (enqueues the import job; deregistration
//       revokes; SSRF-suspicious callback URLs are dropped)

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetServiceByProviderUser = vi.fn();
const mockMarkRevoked = vi.fn();
const mockEnqueueOptional = vi.fn();

vi.mock("../../manager.ts", () => ({
  getServiceByProviderUser: mockGetServiceByProviderUser,
  markRevoked: mockMarkRevoked,
  // imported transitively via import.server.ts
  getServiceById: vi.fn(),
  withFreshCredentials: vi.fn(),
}));
vi.mock("../../../boss.server.ts", () => ({
  enqueueOptional: mockEnqueueOptional,
}));
vi.mock("../../../sync/imports.server.ts", () => ({
  isAlreadyImported: vi.fn(),
  importActivity: vi.fn(),
}));
vi.mock("../../../db.ts", () => ({ getDb: () => ({}) }));

beforeEach(() => {
  mockGetServiceByProviderUser.mockReset();
  mockMarkRevoked.mockReset();
  mockEnqueueOptional.mockReset();
});

const { garminWebhook } = await import("./webhook.ts");
const { isAllowedGarminCallback } = await import("./import.server.ts");

describe("garminWebhook.parseWebhook", () => {
  it("parses a ping-style activityFiles batch into file events", () => {
    const events = garminWebhook.parseWebhook({
      activityFiles: [
        {
          userId: "g-user-1",
          summaryId: "s-1",
          activityId: 1001,
          activityName: "Morning Run",
          callbackURL: "https://apis.garmin.com/wellness-api/rest/activityFile?id=1001",
          fileType: "FIT",
          startTimeInSeconds: 1780000000,
          durationInSeconds: 3600,
          distanceInMeters: 10000,
        },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "garmin:activity-file",
      providerUserId: "g-user-1",
      workoutId: "1001",
      fileUrl: expect.stringContaining("apis.garmin.com"),
      name: "Morning Run",
      duration: 3600,
      distance: 10000,
      fileType: "FIT",
    });
  });

  it("parses push-style activity summaries (FIT-less, stats-only path)", () => {
    const events = garminWebhook.parseWebhook({
      activities: [
        {
          userId: "g-user-1",
          summaryId: "s-2",
          activityId: 1002,
          activityName: "Indoor Row",
          durationInSeconds: 1800,
        },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "garmin:activity-summary",
      workoutId: "1002",
      duration: 1800,
    });
    expect(events[0]!.fileUrl).toBeUndefined();
  });

  it("parses deregistrations", () => {
    const events = garminWebhook.parseWebhook({
      deregistrations: [{ userId: "g-user-1" }],
    });
    expect(events).toEqual([
      {
        eventType: "garmin:deregistration",
        providerUserId: "g-user-1",
        workoutId: "",
      },
    ]);
  });

  it("handles mixed batches and skips malformed entries", () => {
    const events = garminWebhook.parseWebhook({
      activityFiles: [
        { userId: "u1", activityId: 1 },
        { activityId: 2 }, // no userId — skipped
        { userId: "u3" }, // no id — skipped
      ],
      deregistrations: [{}, { userId: "u4" }],
      somethingGarminAddedLater: [{ userId: "u5" }],
    });
    expect(events.map((e) => e.eventType)).toEqual([
      "garmin:activity-file",
      "garmin:deregistration",
    ]);
  });

  it("returns no events for non-object bodies", () => {
    expect(garminWebhook.parseWebhook(null)).toEqual([]);
    expect(garminWebhook.parseWebhook("x")).toEqual([]);
  });
});

describe("garminWebhook.handle", () => {
  const service = { id: "svc-g1", userId: "u1", provider: "garmin" };

  it("enqueues the import job for a known user's file event", async () => {
    mockGetServiceByProviderUser.mockResolvedValue(service);

    await garminWebhook.handle({
      eventType: "garmin:activity-file",
      providerUserId: "g-user-1",
      workoutId: "1001",
      fileUrl: "https://apis.garmin.com/wellness-api/rest/activityFile?id=1001",
      fileType: "FIT",
      name: "Morning Run",
    });

    expect(mockEnqueueOptional).toHaveBeenCalledWith(
      "garmin-import-activity",
      expect.objectContaining({
        serviceId: "svc-g1",
        userId: "u1",
        externalId: "1001",
        callbackUrl: expect.stringContaining("apis.garmin.com"),
        fileType: "FIT",
      }),
      expect.anything(),
    );
  });

  it("silently skips unknown users (no leak)", async () => {
    mockGetServiceByProviderUser.mockResolvedValue(null);
    await garminWebhook.handle({
      eventType: "garmin:activity-file",
      providerUserId: "nobody",
      workoutId: "1",
    });
    expect(mockEnqueueOptional).not.toHaveBeenCalled();
    expect(mockMarkRevoked).not.toHaveBeenCalled();
  });

  it("drops events whose callback URL is not Garmin's API host (SSRF guard)", async () => {
    mockGetServiceByProviderUser.mockResolvedValue(service);
    await garminWebhook.handle({
      eventType: "garmin:activity-file",
      providerUserId: "g-user-1",
      workoutId: "1001",
      fileUrl: "https://attacker.example/steal?token=",
    });
    expect(mockEnqueueOptional).not.toHaveBeenCalled();
  });

  it("revokes the connection on deregistration", async () => {
    mockGetServiceByProviderUser.mockResolvedValue(service);
    await garminWebhook.handle({
      eventType: "garmin:deregistration",
      providerUserId: "g-user-1",
      workoutId: "",
    });
    expect(mockMarkRevoked).toHaveBeenCalledWith("svc-g1");
    expect(mockEnqueueOptional).not.toHaveBeenCalled();
  });
});

describe("isAllowedGarminCallback", () => {
  it("allows only https URLs on Garmin's API host", () => {
    expect(isAllowedGarminCallback("https://apis.garmin.com/wellness-api/rest/x")).toBe(true);
    expect(isAllowedGarminCallback("http://apis.garmin.com/x")).toBe(false);
    expect(isAllowedGarminCallback("https://apis.garmin.com.evil.example/x")).toBe(false);
    expect(isAllowedGarminCallback("https://evil.example/apis.garmin.com")).toBe(false);
    expect(isAllowedGarminCallback("not a url")).toBe(false);
  });
});
