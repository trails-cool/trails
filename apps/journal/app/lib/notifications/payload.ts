// Per-type payload snapshots stored at notification creation time.
// Lets future mobile push / email / RSS renderers display the
// notification without a fresh DB lookup, and lets the web renderer
// fall back to the snapshot when the live record is gone (subject
// deleted, gone private, etc.).
//
// Versioning: every payload type carries an associated `payloadVersion`
// (stored in a separate column on the row, not embedded in the JSON).
// To evolve a payload schema, bump the version and update renderers to
// handle both shapes. Retention naturally ages out old versions.

import type { NotificationType } from "@trails-cool/db/schema/journal";

export const PAYLOAD_VERSION = 1;

export interface FollowPayloadV1 {
  followerUsername: string;
  followerDisplayName: string | null;
}

export interface ApprovalPayloadV1 {
  targetUsername: string;
  targetDisplayName: string | null;
}

export interface ActivityPayloadV1 {
  activityId: string;
  activityName: string;
  ownerUsername: string;
  ownerDisplayName: string | null;
}

export type NotificationPayload =
  | { type: "follow_request_received"; v: 1; payload: FollowPayloadV1 }
  | { type: "follow_received"; v: 1; payload: FollowPayloadV1 }
  | { type: "follow_request_approved"; v: 1; payload: ApprovalPayloadV1 }
  | { type: "activity_published"; v: 1; payload: ActivityPayloadV1 };

// Narrow the `payload` JSONB to the matching shape based on `type` + `v`.
// Renderers should call this rather than indexing into the loose Record.
export function readPayload(
  type: NotificationType,
  version: number,
  payload: Record<string, unknown> | null,
): NotificationPayload["payload"] | null {
  if (!payload || version !== 1) return null;
  switch (type) {
    case "follow_request_received":
    case "follow_received":
      return {
        followerUsername: String(payload.followerUsername ?? ""),
        followerDisplayName:
          (payload.followerDisplayName as string | null | undefined) ?? null,
      };
    case "follow_request_approved":
      return {
        targetUsername: String(payload.targetUsername ?? ""),
        targetDisplayName:
          (payload.targetDisplayName as string | null | undefined) ?? null,
      };
    case "activity_published":
      return {
        activityId: String(payload.activityId ?? ""),
        activityName: String(payload.activityName ?? ""),
        ownerUsername: String(payload.ownerUsername ?? ""),
        ownerDisplayName:
          (payload.ownerDisplayName as string | null | undefined) ?? null,
      };
  }
}
