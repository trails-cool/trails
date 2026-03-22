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
  const [connected, setConnected] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const doc = new Y.Doc();
    const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/sync/${sessionId}`;
    const provider = new WebsocketProvider(wsUrl, sessionId, doc);

    const waypoints = doc.getArray<Y.Map<unknown>>("waypoints");
    const routeData = doc.getMap("routeData");

    // Set local awareness state
    const color = randomItem(COLORS);
    const name = randomItem(NAMES);
    provider.awareness.setLocalStateField("user", { color, name });

    provider.on("status", ({ status }: { status: string }) => {
      setConnected(status === "connected");
    });

    setState({
      doc,
      provider,
      waypoints,
      routeData,
      awareness: provider.awareness,
      connected: false,
    });

    return () => {
      provider.destroy();
      doc.destroy();
    };
  }, [sessionId]);

  if (state) {
    state.connected = connected;
  }

  return state;
}
