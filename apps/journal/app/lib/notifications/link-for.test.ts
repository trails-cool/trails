import { describe, it, expect } from "vitest";
import { linkFor } from "./link-for.ts";

describe("linkFor", () => {
  it("follow_received uses payload.followerUsername", () => {
    const link = linkFor({
      type: "follow_received",
      subjectId: null,
      payloadVersion: 1,
      payload: { followerUsername: "alice", followerDisplayName: null },
    });
    expect(link.web).toBe("/users/alice");
    expect(link.mobile).toBe("trails:/users/alice");
    expect(link.email).toMatch(/^https?:\/\//);
    expect(link.email).toMatch(/\/users\/alice$/);
  });

  it("follow_received falls back to / when payload is missing", () => {
    const link = linkFor({
      type: "follow_received",
      subjectId: null,
      payloadVersion: 1,
      payload: null,
    });
    expect(link.web).toBe("/");
  });

  it("follow_request_received always points at the requests page", () => {
    const link = linkFor({
      type: "follow_request_received",
      subjectId: null,
      payloadVersion: 1,
      payload: { followerUsername: "bob", followerDisplayName: null },
    });
    expect(link.web).toBe("/follows/requests");
  });

  it("follow_request_approved uses payload.targetUsername", () => {
    const link = linkFor({
      type: "follow_request_approved",
      subjectId: null,
      payloadVersion: 1,
      payload: { targetUsername: "carol", targetDisplayName: null },
    });
    expect(link.web).toBe("/users/carol");
  });

  it("activity_published prefers subjectId, falls back to payload.activityId", () => {
    const fromSubject = linkFor({
      type: "activity_published",
      subjectId: "sub-id-1",
      payloadVersion: 1,
      payload: { activityId: "payload-id", activityName: "x", ownerUsername: "o", ownerDisplayName: null },
    });
    expect(fromSubject.web).toBe("/activities/sub-id-1");

    const fromPayload = linkFor({
      type: "activity_published",
      subjectId: null,
      payloadVersion: 1,
      payload: { activityId: "payload-id", activityName: "x", ownerUsername: "o", ownerDisplayName: null },
    });
    expect(fromPayload.web).toBe("/activities/payload-id");
  });

  it("activity_published falls back to / when both subjectId and payload are missing", () => {
    const link = linkFor({
      type: "activity_published",
      subjectId: null,
      payloadVersion: 1,
      payload: null,
    });
    expect(link.web).toBe("/");
  });
});
