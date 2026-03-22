import { useParams } from "react-router";
import type { Route } from "./+types/session.$id";
import { getSession } from "~/lib/sessions";
import { data } from "react-router";
import { ClientOnly } from "~/components/ClientOnly";
import { lazy, Suspense } from "react";

const SessionView = lazy(() =>
  import("~/components/SessionView").then((m) => ({ default: m.SessionView })),
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
            <SessionView sessionId={id!} />
          </Suspense>
        )}
      </ClientOnly>
    </div>
  );
}
