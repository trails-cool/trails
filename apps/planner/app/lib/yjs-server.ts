import { WebSocketServer, type WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import type { IncomingMessage, Server } from "node:http";
import { saveSessionState, loadSessionState, touchSession } from "./sessions.ts";

const messageSync = 0;
const messageAwareness = 1;

const docs = new Map<string, Y.Doc>();
const awarenessMap = new Map<string, awarenessProtocol.Awareness>();
const conns = new Map<WebSocket, { sessionId: string; clientIds: Set<number> }>();

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

function getAwareness(sessionId: string, doc: Y.Doc): awarenessProtocol.Awareness {
  let awareness = awarenessMap.get(sessionId);
  if (!awareness) {
    awareness = new awarenessProtocol.Awareness(doc);
    awarenessMap.set(sessionId, awareness);

    awareness.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const changedClients = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness!, changedClients));
      const message = encoding.toUint8Array(encoder);

      for (const [ws, meta] of conns) {
        if (meta.sessionId === sessionId && ws.readyState === ws.OPEN) {
          ws.send(message);
        }
      }
    });
  }
  return awareness;
}

export function deleteDoc(sessionId: string): boolean {
  const doc = docs.get(sessionId);
  if (doc) {
    doc.destroy();
    docs.delete(sessionId);
    const awareness = awarenessMap.get(sessionId);
    if (awareness) {
      awareness.destroy();
      awarenessMap.delete(sessionId);
    }
    return true;
  }
  return false;
}

export function getDocCount(): number {
  return docs.size;
}

export function getClientCount(sessionId: string): number {
  let count = 0;
  for (const meta of conns.values()) {
    if (meta.sessionId === sessionId) count++;
  }
  return count;
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

function handleMessage(ws: WebSocket, message: Uint8Array, sessionId: string) {
  const doc = docs.get(sessionId);
  if (!doc) return;

  const awareness = awarenessMap.get(sessionId);
  const decoder = decoding.createDecoder(message);
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case messageSync: {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.readSyncMessage(decoder, encoder, doc, ws);
      const resp = encoding.toUint8Array(encoder);
      if (encoding.length(encoder) > 1) {
        ws.send(resp);
      }
      debouncedSave(sessionId);
      break;
    }
    case messageAwareness: {
      if (awareness) {
        const update = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);

        const meta = conns.get(ws);
        if (meta) {
          awareness.getStates().forEach((_state, clientId) => {
            meta.clientIds.add(clientId);
          });
        }
      }
      break;
    }
  }
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
    const awareness = getAwareness(sessionId, doc);

    conns.set(ws, { sessionId, clientIds: new Set() });

    // Broadcast doc updates to all connections in this session
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === ws) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);

      for (const [client, meta] of conns) {
        if (meta.sessionId === sessionId && client !== ws && client.readyState === ws.OPEN) {
          client.send(message);
        }
      }
    };
    doc.on("update", onUpdate);

    // Send sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, doc);
    ws.send(encoding.toUint8Array(encoder));

    // Send current awareness states
    const awarenessStates = awareness.getStates();
    if (awarenessStates.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, messageAwareness);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys())),
      );
      ws.send(encoding.toUint8Array(awarenessEncoder));
    }

    await touchSession(sessionId);

    ws.on("message", (data: ArrayBuffer) => {
      try {
        handleMessage(ws, new Uint8Array(data), sessionId);
      } catch (_e) {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      const meta = conns.get(ws);
      if (meta && meta.clientIds.size > 0) {
        awarenessProtocol.removeAwarenessStates(
          awareness,
          Array.from(meta.clientIds),
          null,
        );
      }
      conns.delete(ws);
      doc.off("update", onUpdate);

      // Save when last client leaves
      const hasClients = Array.from(conns.values()).some((m) => m.sessionId === sessionId);
      if (!hasClients) {
        saveSessionState(sessionId).catch(() => {});
      }
    });
  });

  return wss;
}
