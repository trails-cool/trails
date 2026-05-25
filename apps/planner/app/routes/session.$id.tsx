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
    // Don't leak the JWT token to the client. The save flow uses
    // /api/save-to-journal, which loads token + URL from the DB
    // server-side. The browser only needs to know whether the button
    // should render.
    return data({
      sessionId: session.id,
      hasJournalCallback: Boolean(session.callbackUrl && session.callbackToken),
    });
  });
}

// URL-param caps prevent a hostile link from feeding multi-MB JSON
// into JSON.parse on the client (and from there into the Yjs doc).
// Picked generously enough to accept realistic multi-day routes
// (~hundreds of waypoints) but small enough to refuse abuse.
const MAX_WAYPOINTS_LEN = 50_000;
const MAX_NOGO_LEN = 50_000;
const MAX_NOTES_LEN = 10_000;
const MAX_RETURN_URL_LEN = 2048;

function safeParseJson<T>(raw: string, maxLen: number): T | undefined {
  if (raw.length > maxLen) return undefined;
  try { return JSON.parse(raw) as T; } catch { return undefined; }
}

function safeReturnUrl(raw: string | null): string | undefined {
  if (!raw || raw.length > MAX_RETURN_URL_LEN) return undefined;
  // Same-origin relative path or http(s) absolute URL only. Rejects
  // `javascript:` and protocol-relative `//host` so the value is safe
  // to drop into an `<a href>`.
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return raw;
  } catch { /* fall through */ }
  return undefined;
}

export default function SessionPage({ loaderData }: Route.ComponentProps) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const returnUrl = safeReturnUrl(searchParams.get("returnUrl"));
  const waypointsParam = searchParams.get("waypoints");
  const initialWaypoints = waypointsParam
    ? safeParseJson<Array<{ lat: number; lon: number; name?: string; isDayBreak?: boolean }>>(waypointsParam, MAX_WAYPOINTS_LEN)
    : undefined;
  const noGoParam = searchParams.get("noGoAreas");
  const initialNoGoAreas = noGoParam
    ? safeParseJson<Array<{ points: Array<{ lat: number; lon: number }> }>>(noGoParam, MAX_NOGO_LEN)
    : undefined;
  const notesRaw = searchParams.get("notes");
  const initialNotes = notesRaw && notesRaw.length <= MAX_NOTES_LEN ? notesRaw : undefined;

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
              hasJournalCallback={loaderData.hasJournalCallback}
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
