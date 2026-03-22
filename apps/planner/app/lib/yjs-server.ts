import { WebSocketServer, type WebSocket } from "ws";
import * as Y from "yjs";
import type { IncomingMessage, Server } from "node:http";

const docs = new Map<string, Y.Doc>();

export function getOrCreateDoc(sessionId: string): Y.Doc {
  let doc = docs.get(sessionId);
  if (!doc) {
    doc = new Y.Doc();
    docs.set(sessionId, doc);
  }
  return doc;
}

export function deleteDoc(sessionId: string): boolean {
  const doc = docs.get(sessionId);
  if (doc) {
    doc.destroy();
    docs.delete(sessionId);
    return true;
  }
  return false;
}

export function getDocCount(): number {
  return docs.size;
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

  wss.on("connection", (ws: WebSocket, _request: IncomingMessage, sessionId: string) => {
    const doc = getOrCreateDoc(sessionId);

    // Send current state to new client
    const state = Y.encodeStateAsUpdate(doc);
    ws.send(state);

    // Listen for updates from this client
    ws.on("message", (data: Buffer) => {
      try {
        const update = new Uint8Array(data);
        Y.applyUpdate(doc, update);

        // Broadcast to all other clients in this session
        for (const client of wss.clients) {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(data);
          }
        }
      } catch (_e) {
        // Ignore malformed updates
      }
    });

    ws.on("close", () => {
      // Clean up empty sessions
      // (In production, this would check participant count)
    });
  });

  return wss;
}
