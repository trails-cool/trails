import { Suspense, lazy, useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { TFunction } from "i18next";
import * as Sentry from "@sentry/react";
import { useYjs, type YjsState } from "~/lib/use-yjs";
import { useRouting, type RouteError } from "~/lib/use-routing";
import { ProfileSelector } from "~/components/ProfileSelector";
import { ExportButton } from "~/components/ExportButton";
import { SaveToJournalButton } from "~/components/SaveToJournalButton";
import { YjsDebugPanel } from "~/components/YjsDebugPanel";
import { ParticipantList } from "~/components/ParticipantList";
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

function ColorModeToggle({ yjs }: { yjs: YjsState }) {
  const { t } = useTranslation("planner");
  const [current, setCurrent] = useState<string>("plain");

  useEffect(() => {
    const update = () => {
      setCurrent((yjs.routeData.get("colorMode") as string) ?? "plain");
    };
    yjs.routeData.observe(update);
    update();
    return () => yjs.routeData.unobserve(update);
  }, [yjs.routeData]);

  const setMode = (mode: string) => {
    yjs.routeData.set("colorMode", mode);
  };

  return (
    <select
      value={current}
      onChange={(e) => setMode(e.target.value)}
      className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700"
      title={t("colorMode.label")}
    >
      <option value="plain">{t("colorMode.plain")}</option>
      <option value="elevation">{t("colorMode.elevation")}</option>
      <option value="surface">{t("colorMode.surface")}</option>
    </select>
  );
}

function SidebarTabs({ yjs, routeStats }: { yjs: YjsState; routeStats: ReturnType<typeof useRouting>["routeStats"] }) {
  const { t } = useTranslation("planner");
  const [tab, setTab] = useState<"waypoints" | "notes">("waypoints");

  return (
    <aside className="hidden w-72 border-l border-gray-200 bg-white md:flex md:flex-col">
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab("waypoints")}
          className={`flex-1 px-3 py-2 text-xs font-medium ${tab === "waypoints" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
        >
          {t("sidebar.waypoints", "Waypoints")}
        </button>
        <button
          onClick={() => setTab("notes")}
          className={`flex-1 px-3 py-2 text-xs font-medium ${tab === "notes" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
        >
          {t("sidebar.notes", "Notes")}
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === "waypoints" ? (
          <Suspense fallback={null}>
            <WaypointSidebar yjs={yjs} routeStats={routeStats} />
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
  callbackUrl?: string;
  callbackToken?: string;
  returnUrl?: string;
  initialWaypoints?: Array<{ lat: number; lon: number; name?: string }>;
  initialNoGoAreas?: Array<{ points: Array<{ lat: number; lon: number }> }>;
}

export function SessionView({ sessionId, callbackUrl, callbackToken, returnUrl, initialWaypoints, initialNoGoAreas }: SessionViewProps) {
  const { t } = useTranslation("planner");
  useEffect(() => { Sentry.setTag("session_id", sessionId); }, [sessionId]);
  const yjs = useYjs(sessionId, initialWaypoints, initialNoGoAreas);
  const { computing, routeError, routeStats, requestRoute } = useRouting(yjs);
  const [highlightPosition, setHighlightPosition] = useState<[number, number] | null>(null);
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

  if (!yjs) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">{t("connecting")}</p>
      </div>
    );
  }

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-2 md:gap-4">
          <Link to="/" className="hidden text-lg font-semibold text-gray-900 hover:text-blue-600 sm:block">
            {t("title")}
          </Link>
          <ProfileSelector yjs={yjs} />
          <ParticipantList yjs={yjs} />
        </div>
        <div className="flex items-center gap-3">
          {callbackUrl && callbackToken && (
            <SaveToJournalButton
              yjs={yjs}
              callbackUrl={callbackUrl}
              callbackToken={callbackToken}
              returnUrl={returnUrl}
            />
          )}
          <ExportButton yjs={yjs} />
          <ColorModeToggle yjs={yjs} />
          {computing && (
            <span className="text-xs text-blue-600">{t("computingRoute")}</span>
          )}
          <span className="text-sm text-gray-500">
            {yjs.connected ? t("connected") : t("connecting")} · {sessionId.slice(0, 8)}
          </span>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col">
          <div className="relative flex-1">
            {computing && (
              <div className="absolute inset-x-0 top-0 z-[1000]">
                <div className="h-1 w-full overflow-hidden bg-blue-100">
                  <div className="h-full w-1/3 animate-[slide_1s_ease-in-out_infinite] bg-blue-500" />
                </div>
              </div>
            )}
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center bg-gray-100 text-gray-500">
                  {t("loadingMap")}
                </div>
              }
            >
              <PlannerMap yjs={yjs} onRouteRequest={requestRoute} highlightPosition={highlightPosition} />
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <ElevationChart yjs={yjs} onHover={handleElevationHover} />
          </Suspense>
        </main>
        <SidebarTabs yjs={yjs} routeStats={routeStats} />
      </div>
      <YjsDebugPanel yjs={yjs} />
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
