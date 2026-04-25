// Single source of truth for "what URL does this notification link to?"
// Every renderer (web loader, future mobile push formatter, future email
// formatter) calls linkFor; the type→URL mapping lives here, in one
// place, in three flavors so the same logical destination renders
// correctly per platform.

import type { NotificationType } from "@trails-cool/db/schema/journal";
import { readPayload } from "./payload.ts";

export interface LinkBundle {
  web: string; // app-relative path for in-app navigation
  mobile?: string; // trails:// scheme for native deep linking
  email?: string; // absolute https:// URL for email click-through
}

export interface NotificationForLink {
  type: NotificationType;
  subjectId: string | null;
  payload: Record<string, unknown> | null;
  payloadVersion: number;
}

export function linkFor(n: NotificationForLink): LinkBundle {
  const origin = process.env.ORIGIN ?? "https://trails.cool";
  const p = readPayload(n.type, n.payloadVersion, n.payload);

  switch (n.type) {
    case "follow_received":
    case "follow_request_received": {
      // The actionable surface for a request lives at /follows/requests
      // (where Approve/Reject is); a received auto-accept notification
      // links to the new follower's profile. Both fall back to the
      // payload's followerUsername if the actor account is gone.
      const username =
        p && "followerUsername" in p ? p.followerUsername : null;
      const path =
        n.type === "follow_request_received"
          ? "/follows/requests"
          : username
          ? `/users/${username}`
          : "/";
      return buildBundle(origin, path);
    }
    case "follow_request_approved": {
      const username =
        p && "targetUsername" in p ? p.targetUsername : null;
      const path = username ? `/users/${username}` : "/";
      return buildBundle(origin, path);
    }
    case "activity_published": {
      const activityId =
        n.subjectId ?? (p && "activityId" in p ? p.activityId : null);
      const path = activityId ? `/activities/${activityId}` : "/";
      return buildBundle(origin, path);
    }
  }
}

function buildBundle(origin: string, path: string): LinkBundle {
  return {
    web: path,
    mobile: `trails:/${path.startsWith("/") ? "" : "/"}${path.replace(/^\//, "")}`,
    email: `${origin.replace(/\/$/, "")}${path}`,
  };
}
