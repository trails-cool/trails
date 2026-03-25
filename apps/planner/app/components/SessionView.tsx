import { Suspense, lazy, useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import * as Sentry from "@sentry/react";
import { useYjs } from "~/lib/use-yjs";
import { useRouting } from "~/lib/use-routing";
import { ProfileSelector } from "~/components/ProfileSelector";
import { ExportButton } from "~/components/ExportButton";
import { SaveToJournalButton } from "~/components/SaveToJournalButton";
import { YjsDebugPanel } from "~/components/YjsDebugPanel";

const PlannerMap = lazy(() =>
  import("~/components/PlannerMap").then((m) => ({ default: m.PlannerMap })),
);
const WaypointSidebar = lazy(() =>
  import("~/components/WaypointSidebar").then((m) => ({ default: m.WaypointSidebar })),
);
const ElevationChart = lazy(() =>
  import("~/components/ElevationChart").then((m) => ({ default: m.ElevationChart })),
);

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
  const { isHost, computing, routeStats, requestRoute } = useRouting(yjs);
  const [highlightPosition, setHighlightPosition] = useState<[number, number] | null>(null);

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
          {isHost && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              {t("host")}
            </span>
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
    </>
  );
}
