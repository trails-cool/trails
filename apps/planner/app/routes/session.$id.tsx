import { useParams } from "react-router";
import type { Route } from "./+types/session.$id";
import { getSession } from "~/lib/sessions";
import { data } from "react-router";
import { useYjs } from "~/lib/use-yjs";
import { useRouting } from "~/lib/use-routing";
import { lazy, Suspense } from "react";

const PlannerMap = lazy(() =>
  import("~/components/PlannerMap").then((m) => ({ default: m.PlannerMap })),
);
const WaypointSidebar = lazy(() =>
  import("~/components/WaypointSidebar").then((m) => ({ default: m.WaypointSidebar })),
);

export function meta(_args: Route.MetaArgs) {
  return [{ title: "trails.cool Planner — Session" }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const session = await getSession(params.id);
  if (!session) {
    throw data({ error: "Session not found" }, { status: 404 });
  }
  return data({
    sessionId: session.id,
    hasCallback: !!session.callbackUrl,
  });
}

export default function SessionPage() {
  const { id } = useParams();
  const yjs = useYjs(id!);
  const { isHost, computing, routeStats, requestRoute } = useRouting(yjs);

  if (!yjs) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">Connecting...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <h1 className="text-lg font-semibold text-gray-900">trails.cool Planner</h1>
        <div className="flex items-center gap-3">
          {computing && (
            <span className="text-xs text-blue-600">Computing route...</span>
          )}
          {isHost && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              Host
            </span>
          )}
          <span className="text-sm text-gray-500">
            {yjs.connected ? "Connected" : "Connecting..."} · {id?.slice(0, 8)}
          </span>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-gray-100 text-gray-500">
                Loading map...
              </div>
            }
          >
            <PlannerMap yjs={yjs} onRouteRequest={requestRoute} />
          </Suspense>
        </main>
        <aside className="w-72 border-l border-gray-200 bg-white">
          <Suspense fallback={null}>
            <WaypointSidebar yjs={yjs} routeStats={routeStats} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}
