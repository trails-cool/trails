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

export interface YjsState {
  doc: Y.Doc;
  provider: WebsocketProvider;
  waypoints: Y.Array<Y.Map<unknown>>;
  routeData: Y.Map<unknown>;
  awareness: WebsocketProvider["awareness"];
  connected: boolean;
}

export function useYjs(sessionId: string): YjsState | null {
  const [state, setState] = useState<YjsState | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    docRef.current = doc;

    const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/sync`;
    const provider = new WebsocketProvider(wsUrl, sessionId, doc);
    providerRef.current = provider;

    const waypoints = doc.getArray<Y.Map<unknown>>("waypoints");
    const routeData = doc.getMap("routeData");

    const color = randomItem(COLORS);
    const name = randomItem(NAMES);
    provider.awareness.setLocalStateField("user", { color, name });

    const updateState = (connected: boolean) => {
      setState({
        doc,
        provider,
        waypoints,
        routeData,
        awareness: provider.awareness,
        connected,
      });
    };

    provider.on("status", ({ status }: { status: string }) => {
      updateState(status === "connected");
    });

    // Set initial state (even before connection)
    updateState(false);

    return () => {
      provider.destroy();
      doc.destroy();
      providerRef.current = null;
      docRef.current = null;
    };
  }, [sessionId]);

  return state;
}
