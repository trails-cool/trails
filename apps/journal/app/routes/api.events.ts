import type { Route } from "./+types/api.events";
import { getSessionUser } from "~/lib/auth.server";
import { register } from "~/lib/events.server";
import { countUnread } from "~/lib/notifications.server";

const HEARTBEAT_INTERVAL_MS = 25_000;
// Server-suggested EventSource reconnect delay. Browser default is ~3s;
// 5s + small jitter spreads deploy-storm reconnects without making
// transient blips feel sluggish.
const RECONNECT_RETRY_MS = 5_000;

/**
 * GET /api/events — Server-Sent Events stream. Session-bound; anonymous
 * visitors get 401. Emits `notifications.unread` events when the
 * user's unread count changes (badge live-update).
 *
 * Initial event on connect carries the current count so the client
 * doesn't have to wait for a state change to render.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = user.id;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const writeRaw = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const send = (event: string, data: unknown) => {
        // Per the EventSource spec, multi-line `data:` lines are joined
        // with newlines; JSON-stringifying single-line is enough here.
        writeRaw(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* ignore */ }
      };

      // Server-suggested reconnect backoff + small jitter so deploy
      // storms don't reconnect everyone simultaneously.
      const jitter = Math.floor(Math.random() * 2000);
      writeRaw(`retry: ${RECONNECT_RETRY_MS + jitter}\n\n`);

      const unregister = register(userId, { send, close });

      // Initial state: current unread count, so the client renders
      // correctly without waiting for the first live event.
      const initial = await countUnread(userId);
      send("notifications.unread", { count: initial });

      // Heartbeat keeps intermediate proxies from killing the idle
      // connection. SSE comments are ignored by the client but keep
      // the bytes flowing.
      const heartbeat = setInterval(() => {
        writeRaw(`: ping\n\n`);
      }, HEARTBEAT_INTERVAL_MS);

      // Client disconnect → request.signal aborts → close + clean up.
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unregister();
        close();
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      // Some intermediate proxies buffer text/event-stream by default
      // unless told otherwise; this is the de-facto opt-out hint.
      "X-Accel-Buffering": "no",
    },
  });
}
