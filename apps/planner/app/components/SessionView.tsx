import { Suspense, lazy, useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { TFunction } from "i18next";
import * as Sentry from "@sentry/react";
import { useYjs, type YjsState } from "~/lib/use-yjs";
import { useRouting } from "~/lib/use-routing";
import { ProfileSelector } from "~/components/ProfileSelector";
import { ExportButton } from "~/components/ExportButton";
import { SaveToJournalButton } from "~/components/SaveToJournalButton";
import { YjsDebugPanel } from "~/components/YjsDebugPanel";
import { ParticipantList } from "~/components/ParticipantList";

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
}

let toastIdCounter = 0;

function useAwarenessToasts(yjs: YjsState | null, t: TFunction) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const namesCacheRef = useRef<Map<number, string>>(new Map());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!yjs) return;

    const addToast = (message: string) => {
      const id = ++toastIdCounter;
      setToasts((prev) => [...prev, { id, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 3000);
    };

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
  }, [yjs, t]);

  return toasts;
}

interface SessionViewProps {
  sessionId: string;
  callbackUrl?: string;
  callbackToken?: string;
  returnUrl?: string;
  initialWaypoints?: Array<{ lat: number; lon: number; name?: string }>;
}

export function SessionView({ sessionId, callbackUrl, callbackToken, returnUrl, initialWaypoints }: SessionViewProps) {
  const { t } = useTranslation("planner");
  useEffect(() => { Sentry.setTag("session_id", sessionId); }, [sessionId]);
  const yjs = useYjs(sessionId, initialWaypoints);
  const { computing, routeStats, requestRoute } = useRouting(yjs);
  const [highlightPosition, setHighlightPosition] = useState<[number, number] | null>(null);
  const toasts = useAwarenessToasts(yjs, t);

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
        <aside className="hidden w-72 border-l border-gray-200 bg-white md:block">
          <Suspense fallback={null}>
            <WaypointSidebar yjs={yjs} routeStats={routeStats} />
          </Suspense>
        </aside>
      </div>
      <YjsDebugPanel yjs={yjs} />
      {toasts.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-white shadow-lg animate-[fadeIn_0.2s_ease-out]"
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
