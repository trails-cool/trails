import { useEffect, useState } from "react";

/**
 * Subscribes to /api/events for live `notifications.unread` updates.
 * Returns the live unread count, seeded with the loader-provided
 * baseline so the badge renders correctly before the SSE handshake
 * completes. Native EventSource handles reconnects with the
 * server-suggested `retry:` interval.
 */
export function useUnreadNotifications(initialCount: number, signedIn: boolean): number {
  const [count, setCount] = useState(initialCount);

  // Keep the in-component count in sync if the loader-provided baseline
  // changes (e.g., on navigation).
  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (!signedIn) return;
    if (typeof EventSource === "undefined") return;
    const es = new EventSource("/api/events");
    const onUnread = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as { count: number };
        if (typeof parsed.count === "number") setCount(parsed.count);
      } catch {
        // Malformed payload — ignore.
      }
    };
    es.addEventListener("notifications.unread", onUnread as EventListener);
    return () => {
      es.removeEventListener("notifications.unread", onUnread as EventListener);
      es.close();
    };
  }, [signedIn]);

  return count;
}
