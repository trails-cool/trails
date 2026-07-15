import { Suspense, lazy, useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import type { TFunction } from "i18next";
import * as Sentry from "@sentry/react";
import { useYjs, type YjsState } from "~/lib/use-yjs";
import { useRouting, type RouteError } from "~/lib/use-routing";
import { getCoordinates } from "~/lib/route-data";
import { useDays } from "~/lib/use-days";
import { useUndo, useUndoShortcuts } from "~/lib/use-undo";
import { ProfileSelector } from "~/components/ProfileSelector";
import { ExportButton } from "~/components/ExportButton";
import { SaveToJournalButton } from "~/components/SaveToJournalButton";
import { YjsDebugPanel } from "~/components/YjsDebugPanel";
import { Topbar } from "~/components/Topbar";
import { useParticipants } from "~/lib/use-participants";
import { NotesPanel } from "~/components/NotesPanel";

const PlannerMap = lazy(() =>
  import("~/components/PlannerMap").then((m) => ({ default: m.PlannerMap })),
);
const WaypointSidebar = lazy(() =>
  import("~/components/WaypointSidebar").then((m) => ({ default: m.WaypointSidebar })),
);
const ElevationChart = lazy(() =>
  import("~/components/ElevationChart").then((m) => ({ default: m.ElevationChart })),
);

interface Toast {
  id: number;
  message: string;
  variant?: "error" | "info";
}

let toastIdCounter = 0;

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, variant: Toast["variant"] = "info") => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  return { toasts, addToast };
}

function useAwarenessToasts(yjs: YjsState | null, t: TFunction, addToast: (message: string) => void) {
  const namesCacheRef = useRef<Map<number, string>>(new Map());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!yjs) return;

    const handleChange = (
      changes: { added: number[]; updated: number[]; removed: number[] },
    ) => {
      const states = yjs.awareness.getStates();
      const localId = yjs.awareness.clientID;

      // On first change, seed the cache with current participants and skip toasts
      if (!initializedRef.current) {
        states.forEach((state, clientId) => {
          const user = (state as Record<string, unknown>).user as { name: string } | undefined;
          if (user?.name) {
            namesCacheRef.current.set(clientId, user.name);
          }
        });
        initializedRef.current = true;
        return;
      }

      // Update cache for any updated clients
      for (const clientId of changes.updated) {
        const state = states.get(clientId) as Record<string, unknown> | undefined;
        const user = state?.user as { name: string } | undefined;
        if (user?.name) {
          namesCacheRef.current.set(clientId, user.name);
        }
      }

      for (const clientId of changes.added) {
        if (clientId === localId) continue;
        const state = states.get(clientId) as Record<string, unknown> | undefined;
        const user = state?.user as { name: string } | undefined;
        const name = user?.name;
        if (name) {
          namesCacheRef.current.set(clientId, name);
          addToast(t("participants.joined", { name }));
        }
      }

      for (const clientId of changes.removed) {
        if (clientId === localId) continue;
        const name = namesCacheRef.current.get(clientId);
        namesCacheRef.current.delete(clientId);
        if (name) {
          addToast(t("participants.left", { name }));
        }
      }
    };

    yjs.awareness.on("change", handleChange);

    return () => {
      yjs.awareness.off("change", handleChange);
      initializedRef.current = false;
      namesCacheRef.current.clear();
    };
  }, [yjs, t, addToast]);
}


function SidebarTabs({ yjs, routeStats, days, onWaypointHover, onWaypointSelect }: { yjs: YjsState; routeStats: ReturnType<typeof useRouting>["routeStats"]; days: ReturnType<typeof useDays>; onWaypointHover: (index: number | null) => void; onWaypointSelect: (index: number | null) => void }) {
  const { t } = useTranslation("planner");
  const [tab, setTab] = useState<"waypoints" | "notes">("waypoints");

  return (
    <aside className="hidden w-72 border-l border-border bg-bg-raised md:flex md:flex-col">
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab("waypoints")}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${tab === "waypoints" ? "border-b-2 border-accent text-accent" : "text-text-md hover:text-text-hi"}`}
        >
          {t("sidebar.waypoints", "Waypoints")}
        </button>
        <button
          onClick={() => setTab("notes")}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${tab === "notes" ? "border-b-2 border-accent text-accent" : "text-text-md hover:text-text-hi"}`}
        >
          {t("sidebar.notes", "Notes")}
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === "waypoints" ? (
          <Suspense fallback={null}>
            <WaypointSidebar yjs={yjs} routeStats={routeStats} days={days} onWaypointHover={onWaypointHover} onWaypointSelect={onWaypointSelect} />
          </Suspense>
        ) : (
          <NotesPanel yjs={yjs} />
        )}
      </div>
    </aside>
  );
}

interface SessionViewProps {
  sessionId: string;
  /**
   * True when the session was created with a journal callback URL +
   * token (i.e. the user came in from /journal/.../edit-in-planner).
   * The actual URL + token live server-side; the browser only needs
   * to know whether to render the Save-to-Journal button.
   */
  hasJournalCallback?: boolean;
  returnUrl?: string;
  initialWaypoints?: Array<{ lat: number; lon: number; name?: string; isDayBreak?: boolean }>;
  initialNoGoAreas?: Array<{ points: Array<{ lat: number; lon: number }> }>;
  initialNotes?: string;
}

export function SessionView({ sessionId, hasJournalCallback, returnUrl, initialWaypoints, initialNoGoAreas, initialNotes }: SessionViewProps) {
  const { t } = useTranslation("planner");
  useEffect(() => { Sentry.setTag("session_id", sessionId); }, [sessionId]);
  const yjs = useYjs(sessionId, initialWaypoints, initialNoGoAreas, initialNotes);
  const { computing, routeError, routeStats, requestRoute } = useRouting(yjs, sessionId);
  const { canUndo, canRedo, undo, redo } = useUndo(yjs?.undoManager ?? null);
  useUndoShortcuts(yjs?.undoManager ?? null);
  const { participants, renameLocal } = useParticipants(yjs);
  const days = useDays(yjs);
  const [highlightPosition, setHighlightPosition] = useState<[number, number] | null>(null);
  const [highlightedWaypoint, setHighlightedWaypoint] = useState<number | null>(null);
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<number | null>(null);
  const [highlightChartDistance, setHighlightChartDistance] = useState<number | null>(null);
  const [isZoomedByChart, setIsZoomedByChart] = useState(false);
  const { toasts, addToast } = useToasts();
  useAwarenessToasts(yjs, t, addToast);

  // Show toast on route calculation error
  const prevErrorRef = useRef<RouteError>(null);
  useEffect(() => {
    if (routeError && routeError !== prevErrorRef.current) {
      const message =
        routeError === "rate_limit" ? t("rateLimitExceeded") :
        routeError === "no_route" ? t("noRouteFound") :
        t("routeError");
      addToast(message, "error");
    }
    prevErrorRef.current = routeError;
  }, [routeError, addToast, t]);

  const handleElevationHover = useCallback((pos: [number, number] | null) => {
    setHighlightPosition(pos);
  }, []);

  const handleChartClick = useCallback((position: [number, number]) => {
    const map = window.__leafletMap;
    map?.panTo(position);
  }, []);

  const handleChartDragSelect = useCallback((bounds: [[number, number], [number, number]]) => {
    const map = window.__leafletMap;
    map?.fitBounds(bounds, { padding: [30, 30] });
    setIsZoomedByChart(true);
  }, []);

  const handleResetZoom = useCallback(() => {
    const map = window.__leafletMap;
    if (!map || !yjs) return;
    const coords = getCoordinates(yjs.routeData);
    if (!coords || coords.length < 2) return;
    const latLngs = coords.map((c) => [c[1], c[0]] as [number, number]);
    map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50] });
    setIsZoomedByChart(false);
  }, [yjs]);

  if (!yjs) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">{t("connecting")}</p>
      </div>
    );
  }

  return (
    <>
      <Topbar
        participants={participants}
        onRenameLocal={renameLocal}
        connected={yjs.connected}
        sessionShortId={sessionId.slice(0, 8)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        profileSlot={<ProfileSelector yjs={yjs} />}
        actions={
          <>
            {hasJournalCallback && (
              <SaveToJournalButton
                yjs={yjs}
                sessionId={sessionId}
                returnUrl={returnUrl}
              />
            )}
            <ExportButton yjs={yjs} />
          </>
        }
      />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col">
          <div className="relative flex-1">
            {computing && (
              <>
                {/* Ambient indeterminate progress along the top edge */}
                <div className="absolute inset-x-0 top-0 z-[1000]">
                  <div className="h-0.5 w-full overflow-hidden bg-accent-bg">
                    <div className="h-full w-1/3 animate-[slide_1s_ease-in-out_infinite] bg-accent" />
                  </div>
                </div>
                {/* Floating status pill — overlays the map without shifting layout */}
                <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-bg-raised px-3 py-1 text-xs font-medium text-text-md shadow-md">
                  <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
                  {t("computingRoute")}
                </div>
              </>
            )}
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center bg-gray-100 text-gray-500">
                  {t("loadingMap")}
                </div>
              }
            >
              <PlannerMap yjs={yjs} sessionId={sessionId} onRouteRequest={requestRoute} highlightPosition={highlightPosition} highlightedWaypoint={highlightedWaypoint} selectedWaypointIndex={selectedWaypointIndex} onRouteHover={setHighlightChartDistance} onImportError={(msg) => addToast(msg, "error")} days={days} />
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <div className="relative">
              <ElevationChart yjs={yjs} onHover={handleElevationHover} highlightDistance={highlightChartDistance} onClickPosition={handleChartClick} onDragSelect={handleChartDragSelect} days={days} />
              {isZoomedByChart && (
                <button
                  onClick={handleResetZoom}
                  className="absolute bottom-7 right-3 z-10 rounded-md bg-bg-raised px-2 py-0.5 text-[11px] font-medium text-text-md shadow-sm ring-1 ring-border transition-colors hover:bg-bg-subtle"
                >
                  {t("elevation.resetZoom", "Reset zoom")}
                </button>
              )}
            </div>
          </Suspense>
        </main>
        <SidebarTabs yjs={yjs} routeStats={routeStats} days={days} onWaypointHover={setHighlightedWaypoint} onWaypointSelect={setSelectedWaypointIndex} />
      </div>
      <YjsDebugPanel yjs={yjs} sessionId={sessionId} />
      {toasts.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-lg px-4 py-2 text-sm text-white shadow-lg animate-[fadeIn_0.2s_ease-out] ${
                toast.variant === "error" ? "bg-red-600" : "bg-gray-800"
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
