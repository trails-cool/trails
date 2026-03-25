import { WebSocketServer, type WebSocket } from "ws";
import * as Y from "yjs";
import type { IncomingMessage, Server } from "node:http";
import { saveSessionState, loadSessionState, touchSession } from "./sessions.ts";

const docs = new Map<string, Y.Doc>();
const sessionClients = new Map<string, Set<WebSocket>>();

export function getOrCreateDoc(sessionId: string): Y.Doc {
  let doc = docs.get(sessionId);
  if (!doc) {
    doc = new Y.Doc();
    docs.set(sessionId, doc);
  }
  return doc;
}

export async function getOrLoadDoc(sessionId: string): Promise<Y.Doc> {
  let doc = docs.get(sessionId);
  if (!doc) {
    doc = new Y.Doc();
    const savedState = await loadSessionState(sessionId);
    if (savedState) {
      Y.applyUpdate(doc, savedState);
    }
    docs.set(sessionId, doc);
  }
  return doc;
}

export function deleteDoc(sessionId: string): boolean {
  const doc = docs.get(sessionId);
  if (doc) {
    doc.destroy();
    docs.delete(sessionId);
    sessionClients.delete(sessionId);
    return true;
  }
  return false;
}

export function getDocCount(): number {
  return docs.size;
}

export function getClientCount(sessionId: string): number {
  return sessionClients.get(sessionId)?.size ?? 0;
}

// Debounced persistence — save at most every 5 seconds per session
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function debouncedSave(sessionId: string): void {
  if (saveTimers.has(sessionId)) return;
  saveTimers.set(
    sessionId,
    setTimeout(async () => {
      saveTimers.delete(sessionId);
      try {
        await saveSessionState(sessionId);
      } catch (_e) {
        // Log but don't crash on save failure
      }
    }, 5000),
  );
}

export function setupYjsWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "", `http://${request.headers.host}`);
    const match = url.pathname.match(/^\/sync\/(.+)$/);

    if (!match) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, match[1]);
    });
  });

  wss.on("connection", async (ws: WebSocket, _request: IncomingMessage, sessionId: string) => {
    const doc = await getOrLoadDoc(sessionId);

    // Track clients per session
    if (!sessionClients.has(sessionId)) {
      sessionClients.set(sessionId, new Set());
    }
    sessionClients.get(sessionId)!.add(ws);

    // Send current state to new client
    const state = Y.encodeStateAsUpdate(doc);
    ws.send(state);

    await touchSession(sessionId);

    // Listen for updates from this client
    ws.on("message", (data: Buffer) => {
      try {
        const update = new Uint8Array(data);
        Y.applyUpdate(doc, update);

        // Broadcast to all other clients in this session
        const clients = sessionClients.get(sessionId);
        if (clients) {
          for (const client of clients) {
            if (client !== ws && client.readyState === ws.OPEN) {
              client.send(data);
            }
          }
        }

        // Persist state (debounced)
        debouncedSave(sessionId);
      } catch (_e) {
        // Ignore malformed updates
      }
    });

    ws.on("close", () => {
      const clients = sessionClients.get(sessionId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          // Last client left — save immediately
          saveSessionState(sessionId).catch(() => {});
        }
      }
    });
  });

  return wss;
}
