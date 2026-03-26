import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

const NAMES = [
  "Hiker", "Cyclist", "Runner", "Explorer",
  "Wanderer", "Pathfinder", "Trailblazer", "Navigator",
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function getOrCreateUserIdentity(): { color: string; name: string } {
  try {
    const stored = localStorage.getItem("trails:user");
    if (stored) return JSON.parse(stored);
  } catch { /* localStorage unavailable */ }

  const identity = { color: randomItem(COLORS), name: randomItem(NAMES) };
  try { localStorage.setItem("trails:user", JSON.stringify(identity)); } catch { /* localStorage unavailable */ }
  return identity;
}

export interface YjsState {
  doc: Y.Doc;
  provider: WebsocketProvider;
  waypoints: Y.Array<Y.Map<unknown>>;
  routeData: Y.Map<unknown>;
  noGoAreas: Y.Array<Y.Map<unknown>>;
  notes: Y.Text;
  awareness: WebsocketProvider["awareness"];
  connected: boolean;
  setUserName: (name: string) => void;
}

export function useYjs(
  sessionId: string,
  initialWaypoints?: Array<{ lat: number; lon: number; name?: string }>,
): YjsState | null {
  const [state, setState] = useState<YjsState | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const initializedWaypoints = useRef(false);
  const identityRef = useRef<{ color: string; name: string } | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    docRef.current = doc;

    const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/sync`;
    const provider = new WebsocketProvider(wsUrl, sessionId, doc);
    providerRef.current = provider;

    const waypoints = doc.getArray<Y.Map<unknown>>("waypoints");
    const routeData = doc.getMap("routeData");
    const noGoAreas = doc.getArray<Y.Map<unknown>>("noGoAreas");
    const notes = doc.getText("notes");

    // --- Crash Recovery: restore state from localStorage ---
    const storageKey = `trails:session:${sessionId}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const update = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
        Y.applyUpdate(doc, update);
      }
    } catch { /* localStorage unavailable or corrupted */ }

    // --- Crash Recovery: periodic save to localStorage ---
    const saveInterval = setInterval(() => {
      try {
        const state = Y.encodeStateAsUpdate(doc);
        const b64 = btoa(String.fromCharCode(...state));
        localStorage.setItem(storageKey, b64);
      } catch { /* localStorage unavailable */ }
    }, 10_000);

    const identity = getOrCreateUserIdentity();
    identityRef.current = identity;
    provider.awareness.setLocalStateField("user", { color: identity.color, name: identity.name });

    const setUserName = (newName: string) => {
      if (!identityRef.current) return;
      identityRef.current = { ...identityRef.current, name: newName };
      try { localStorage.setItem("trails:user", JSON.stringify(identityRef.current)); } catch { /* localStorage unavailable */ }
      provider.awareness.setLocalStateField("user", { ...identityRef.current });
    };

    // Initialize waypoints once after first sync
    if (initialWaypoints?.length && !initializedWaypoints.current) {
      (provider as unknown as { on(event: string, cb: () => void): void }).on("synced", () => {
        // Only add if the doc is empty (avoid duplicating on reconnect)
        if (waypoints.length === 0 && !initializedWaypoints.current) {
          initializedWaypoints.current = true;
          doc.transact(() => {
            for (const wp of initialWaypoints) {
              const yMap = new Y.Map();
              yMap.set("lat", wp.lat);
              yMap.set("lon", wp.lon);
              if (wp.name) yMap.set("name", wp.name);
              waypoints.push([yMap]);
            }
          });
        }
      });
    }

    const updateState = (connected: boolean) => {
      setState({
        doc,
        provider,
        waypoints,
        routeData,
        noGoAreas,
        notes,
        awareness: provider.awareness,
        connected,
        setUserName,
      });
    };

    provider.on("status", ({ status }: { status: string }) => {
      updateState(status === "connected");
    });

    updateState(false);

    return () => {
      clearInterval(saveInterval);
      // Clear localStorage on clean disconnect (session close)
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      provider.destroy();
      doc.destroy();
      providerRef.current = null;
      docRef.current = null;
    };
  }, [sessionId]);

  return state;
}
