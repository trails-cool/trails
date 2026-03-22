import { useParams } from "react-router";
import type { Route } from "./+types/session.$id";
import { getSession } from "~/lib/sessions";
import { data } from "react-router";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "trails.cool Planner — Session" }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const session = getSession(params.id);
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
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <h1 className="text-lg font-semibold text-gray-900">trails.cool Planner</h1>
        <span className="text-sm text-gray-500">Session: {id?.slice(0, 8)}...</span>
      </header>
      <div className="flex flex-1">
        <main className="flex-1 bg-gray-100">
          <div className="flex h-full items-center justify-center text-gray-500">
            Map will be rendered here (task 6.1)
          </div>
        </main>
        <aside className="w-80 border-l border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-700">Waypoints</h2>
          <p className="mt-2 text-sm text-gray-500">
            Waypoint list will be rendered here (task 6.5)
          </p>
        </aside>
      </div>
    </div>
  );
}
