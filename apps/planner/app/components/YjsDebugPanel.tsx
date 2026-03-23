import { useEffect, useState, useCallback } from "react";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import type { YjsState } from "~/lib/use-yjs";

// --- localStorage helpers ---

function loadBool(key: string, fallback: boolean): boolean {
  try { return localStorage.getItem(key) === "1"; } catch { return fallback; }
}

function saveBool(key: string, value: boolean) {
  try { localStorage.setItem(key, value ? "1" : "0"); } catch { /* localStorage unavailable */ }
}

// --- Debug state ---

interface DebugState {
  waypoints: Array<Record<string, unknown>>;
  routeData: Record<string, unknown>;
  awareness: Array<{ clientId: number; state: Record<string, unknown> }>;
  docSize: number;
}

function serializeYMap(yMap: Y.Map<unknown>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  yMap.forEach((value, key) => {
    if (value instanceof Y.Map) {
      obj[key] = serializeYMap(value);
    } else if (value instanceof Y.Array) {
      obj[key] = `Y.Array(${value.length})`;
    } else if (typeof value === "string" && value.length > 200) {
      obj[key] = value.slice(0, 200) + `... (${value.length} chars)`;
    } else {
      obj[key] = value;
    }
  });
  return obj;
}

function getDebugState(yjs: YjsState): DebugState {
  const waypoints = yjs.waypoints.toArray().map((yMap) => serializeYMap(yMap));

  const routeData: Record<string, unknown> = {};
  yjs.routeData.forEach((value, key) => {
    if (typeof value === "string" && value.length > 100) {
      routeData[key] = `string(${value.length} chars)`;
    } else {
      routeData[key] = value;
    }
  });

  const awareness: DebugState["awareness"] = [];
  yjs.awareness.getStates().forEach((state, clientId) => {
    awareness.push({ clientId, state: state as Record<string, unknown> });
  });

  const docSize = Y.encodeStateAsUpdate(yjs.doc).byteLength;

  return { waypoints, routeData, awareness, docSize };
}

// --- Styles ---

const btnClass =
  "rounded bg-gray-700 px-2 py-0.5 text-[10px] hover:bg-gray-600 active:bg-gray-500 transition-colors";
const dangerBtnClass =
  "rounded bg-red-900 px-2 py-0.5 text-[10px] text-red-200 hover:bg-red-800 active:bg-red-700 transition-colors";

// --- Component ---

/**
 * Yjs debug panel with:
 * - Visibility: shown in dev by default, toggle with Shift+Cmd+Option+T anywhere
 * - Expanded state: persisted in localStorage
 * - Actions: reset session, refetch route, become host, kick users
 * - State inspector: awareness, waypoints, route data, doc stats
 */
export function YjsDebugPanel({ yjs }: { yjs: YjsState }) {
  const [visible, setVisible] = useState(() => loadBool("trails:debug", import.meta.env.DEV));
  const [expanded, setExpanded] = useState(() => loadBool("trails:debug:expanded", false));
  const [state, setState] = useState<DebugState | null>(null);

  // Hotkey: Shift+Cmd+Option+T
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && e.metaKey && e.altKey && e.code === "KeyT") {
        e.preventDefault();
        setVisible((v) => {
          const next = !v;
          saveBool("trails:debug", next);
          return next;
        });
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);

  // Sync Yjs state
  useEffect(() => {
    if (!visible) return;

    const update = () => setState(getDebugState(yjs));

    yjs.waypoints.observe(update);
    yjs.routeData.observe(update);
    yjs.awareness.on("change", update);
    update();

    const interval = setInterval(update, 2000);

    return () => {
      yjs.waypoints.unobserve(update);
      yjs.routeData.unobserve(update);
      yjs.awareness.off("change", update);
      clearInterval(interval);
    };
  }, [yjs, visible]);

  // Actions

  const resetSession = useCallback(() => {
    yjs.doc.transact(() => {
      while (yjs.waypoints.length > 0) {
        yjs.waypoints.delete(0, 1);
      }
      yjs.routeData.delete("geojson");
      yjs.routeData.delete("profile");
    });
  }, [yjs]);

  const refetchRoute = useCallback(async () => {
    const waypoints = yjs.waypoints.toArray().map((yMap: Y.Map<unknown>) => ({
      lat: yMap.get("lat") as number,
      lon: yMap.get("lon") as number,
    }));

    if (waypoints.length < 2) return;

    const profile = (yjs.routeData.get("profile") as string) ?? "trekking";
    const response = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waypoints, profile }),
    });

    if (response.ok) {
      const geojson = await response.json();
      yjs.routeData.set("geojson", JSON.stringify(geojson));
    }
  }, [yjs]);

  const kickUser = useCallback(
    (clientId: number) => {
      if (clientId === yjs.awareness.clientID) return;
      awarenessProtocol.removeAwarenessStates(yjs.awareness, [clientId], "kicked");
    },
    [yjs],
  );

  const toggleExpanded = useCallback(() => {
    setExpanded((v) => {
      const next = !v;
      saveBool("trails:debug:expanded", next);
      return next;
    });
  }, []);

  // Render

  if (!visible || !state) return null;

  return (
    <div className="fixed bottom-0 right-0 z-[2000] max-h-[50vh] w-96 overflow-auto rounded-tl-lg border-l border-t border-gray-300 bg-gray-900 text-xs text-gray-100 shadow-lg">
      <button
        onClick={toggleExpanded}
        className="sticky top-0 flex w-full items-center justify-between bg-gray-800 px-3 py-1.5 font-mono text-xs hover:bg-gray-700"
      >
        <span>Yjs Debug</span>
        <span className="text-gray-400">
          {state.waypoints.length} wps · {state.awareness.length} users · {(state.docSize / 1024).toFixed(1)}KB
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 p-3 font-mono">
          <Section title="Actions">
            <div className="flex flex-wrap gap-1.5">
              <button onClick={refetchRoute} className={btnClass}>
                Refetch route
              </button>
              <button onClick={resetSession} className={dangerBtnClass}>
                Reset session
              </button>
            </div>
          </Section>

          <Section title="Awareness">
            {state.awareness.map((a) => (
              <div key={a.clientId} className="mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400">client:{a.clientId}</span>
                  {a.clientId === yjs.awareness.clientID && (
                    <span className="text-green-400">(you)</span>
                  )}
                  {Object.keys(a.state).length === 0 && (
                    <span className="text-gray-500">(server)</span>
                  )}
                  {a.clientId !== yjs.awareness.clientID && Object.keys(a.state).length > 0 && (
                    <button
                      onClick={() => kickUser(a.clientId)}
                      className={dangerBtnClass}
                    >
                      kick
                    </button>
                  )}
                </div>
                <pre className="ml-2 text-gray-400">{JSON.stringify(a.state, null, 1)}</pre>
              </div>
            ))}
          </Section>

          <Section title={`Waypoints (${state.waypoints.length})`}>
            {state.waypoints.map((wp, i) => (
              <div key={i} className="text-gray-300">
                [{i}] {JSON.stringify(wp)}
              </div>
            ))}
            {state.waypoints.length === 0 && <span className="text-gray-500">empty</span>}
          </Section>

          <Section title="Route Data">
            <pre className="text-gray-300">{JSON.stringify(state.routeData, null, 1)}</pre>
          </Section>

          <Section title="Doc Stats">
            <div className="text-gray-300">
              Size: {(state.docSize / 1024).toFixed(1)} KB
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-blue-400">{title}</div>
      <div className="ml-1">{children}</div>
    </div>
  );
}
