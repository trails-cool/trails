import { useParams, useSearchParams } from "react-router";
import type { Route } from "./+types/session.$id";
import { getSession } from "~/lib/sessions";
import { data } from "react-router";
import { withDb } from "@trails-cool/db";
import { ClientOnly } from "~/components/ClientOnly";
import { lazy, Suspense } from "react";

const SessionView = lazy(() =>
  import("~/components/SessionView").then((m) => ({ default: m.SessionView })),
);

export function meta(_args: Route.MetaArgs) {
  return [{ title: "trails.cool Planner — Session" }];
}

export async function loader({ params }: Route.LoaderArgs) {
  return withDb(async () => {
    const session = await getSession(params.id);
    if (!session) {
      throw data({ error: "Session not found" }, { status: 404 });
    }
    return data({
      sessionId: session.id,
      callbackUrl: session.callbackUrl ?? null,
      callbackToken: session.callbackToken ?? null,
    });
  });
}

export default function SessionPage({ loaderData }: Route.ComponentProps) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") ?? undefined;
  const waypointsParam = searchParams.get("waypoints");
  let initialWaypoints: Array<{ lat: number; lon: number; name?: string; isDayBreak?: boolean }> | undefined;
  if (waypointsParam) {
    try { initialWaypoints = JSON.parse(waypointsParam); } catch { /* ignore */ }
  }
  const noGoParam = searchParams.get("noGoAreas");
  let initialNoGoAreas: Array<{ points: Array<{ lat: number; lon: number }> }> | undefined;
  if (noGoParam) {
    try { initialNoGoAreas = JSON.parse(noGoParam); } catch { /* ignore */ }
  }
  const initialNotes = searchParams.get("notes") ?? undefined;

  return (
    <div className="flex h-full flex-col">
      <ClientOnly
        fallback={
          <div className="flex h-full items-center justify-center">
            <p className="text-gray-500">Loading planner...</p>
          </div>
        }
      >
        {() => (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <p className="text-gray-500">Loading planner...</p>
              </div>
            }
          >
            <SessionView
              sessionId={id!}
              callbackUrl={loaderData.callbackUrl ?? undefined}
              callbackToken={loaderData.callbackToken ?? undefined}
              returnUrl={returnUrl}
              initialWaypoints={initialWaypoints}
              initialNoGoAreas={initialNoGoAreas}
              initialNotes={initialNotes}
            />
          </Suspense>
        )}
      </ClientOnly>
    </div>
  );
}
