import type { Plugin } from "vite";
import { WebSocketServer, type WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const messageSync = 0;
const messageAwareness = 1;

/**
 * Vite plugin that runs a Yjs sync server in dev mode.
 * Implements the y-websocket protocol for full compatibility.
 */
export function yjsDevPlugin(): Plugin {
  const docs = new Map<string, Y.Doc>();
  const awarenessMap = new Map<string, awarenessProtocol.Awareness>();
  const conns = new Map<WebSocket, { docName: string; awarenessIds: Set<number> }>();

  function getDoc(docName: string): { doc: Y.Doc; awareness: awarenessProtocol.Awareness } {
    let doc = docs.get(docName);
    let awareness = awarenessMap.get(docName);
    if (!doc) {
      doc = new Y.Doc();
      docs.set(docName, doc);
      awareness = new awarenessProtocol.Awareness(doc);
      awarenessMap.set(docName, awareness);

      awareness.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
        const changedClients = added.concat(updated, removed);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness!, changedClients));
        const message = encoding.toUint8Array(encoder);

        for (const [ws, meta] of conns) {
          if (meta.docName === docName) {
            ws.send(message);
          }
        }
      });
    }
    return { doc, awareness: awareness! };
  }

  function handleMessage(ws: WebSocket, message: Uint8Array, docName: string) {
    const { doc, awareness } = getDoc(docName);
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
        break;
      }
      case messageAwareness: {
        const update = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
        break;
      }
    }
  }

  return {
    name: "yjs-dev-websocket",
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });

      server.httpServer?.on("upgrade", (request, socket, head) => {
        const url = new URL(request.url ?? "", `http://${request.headers.host}`);
        if (!url.pathname.startsWith("/sync/")) return;

        const docName = url.pathname.slice("/sync/".length);

        wss.handleUpgrade(request, socket, head, (ws) => {
          const { doc, awareness } = getDoc(docName);
          conns.set(ws, { docName, awarenessIds: new Set() });

          // Send sync step 1
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.writeSyncStep1(encoder, doc);
          ws.send(encoding.toUint8Array(encoder));

          // Send awareness states
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

          ws.on("message", (data: ArrayBuffer) => {
            handleMessage(ws, new Uint8Array(data), docName);
          });

          ws.on("close", () => {
            const meta = conns.get(ws);
            if (meta) {
              awarenessProtocol.removeAwarenessStates(awareness, Array.from(meta.awarenessIds), null);
            }
            conns.delete(ws);
          });
        });
      });
    },
  };
}
