import { useState, useCallback, useEffect } from "react";
import { data } from "react-router";
import { useTranslation } from "react-i18next";
import { eq, count } from "drizzle-orm";
import type { Route } from "./+types/home";
import { getSessionUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db";
import { credentials } from "@trails-cool/db/schema/journal";
import { listActivities, listRecentPublicActivities } from "~/lib/activities.server";
import { ClientDate } from "~/components/ClientDate";
import { ClientMap } from "~/components/ClientMap";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "trails.cool" },
    { name: "description", content: "Federated outdoor journal. Plan routes, record activities, own your data." },
  ];
}

interface ActivityCard {
  id: string;
  name: string;
  distance: number | null;
  elevationGain: number | null;
  duration: number | null;
  startedAt: string | null;
  createdAt: string;
  geojson: string | null;
  // Populated only for the public (logged-out) feed, where the card
  // needs to attribute the activity to an owner. Personal feed skips
  // these because it's always "you".
  ownerUsername: string | null;
  ownerDisplayName: string | null;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  const url = new URL(request.url);
  const addPasskeyParam = url.searchParams.get("add-passkey") === "1" && user !== null;

  // Only show the add-passkey prompt if the user has no passkeys yet
  let showAddPasskey = false;
  if (addPasskeyParam && user) {
    const db = getDb();
    const [row] = await db
      .select({ count: count() })
      .from(credentials)
      .where(eq(credentials.userId, user.id));
    showAddPasskey = (row?.count ?? 0) === 0;
  }

  const plannerUrl = process.env.PLANNER_URL ?? "https://planner.trails.cool";
  const isFlagship = process.env.IS_FLAGSHIP === "true";

  // Logged-in users get their own recent activities as the home feed —
  // "home" should mean your stuff, not the instance's public stream.
  // Logged-out visitors get the instance-wide public feed instead.
  let activities: ActivityCard[];
  if (user) {
    const rows = await listActivities(user.id);
    activities = rows.slice(0, 20).map((a) => ({
      id: a.id,
      name: a.name,
      distance: a.distance,
      elevationGain: a.elevationGain,
      duration: a.duration,
      startedAt: a.startedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      geojson: a.geojson ?? null,
      ownerUsername: null,
      ownerDisplayName: null,
    }));
  } else {
    const rows = await listRecentPublicActivities(20);
    activities = rows.map((a) => ({
      id: a.id,
      name: a.name,
      distance: a.distance,
      elevationGain: a.elevationGain,
      duration: a.duration,
      startedAt: a.startedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      geojson: a.geojson ?? null,
      ownerUsername: a.ownerUsername,
      ownerDisplayName: a.ownerDisplayName,
    }));
  }

  return data({
    user: user ? { id: user.id, username: user.username, displayName: user.displayName } : null,
    showAddPasskey,
    plannerUrl,
    isFlagship,
    activities,
  });
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user, showAddPasskey, plannerUrl, isFlagship, activities } = loaderData;
  const { t } = useTranslation("journal");
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [passkeyDone, setPasskeyDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportsPasskey, setSupportsPasskey] = useState<boolean | null>(null);

  useEffect(() => {
    if (showAddPasskey) {
      import("@simplewebauthn/browser").then(({ browserSupportsWebAuthn }) => {
        setSupportsPasskey(browserSupportsWebAuthn());
      });
    }
  }, [showAddPasskey]);

  const handleAddPasskey = useCallback(async () => {
    if (!user) return;
    setAddingPasskey(true);
    setError(null);

    try {
      const startResp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "add-passkey", userId: user.id }),
      });
      const startData = await startResp.json();

      if (startData.error) {
        setError(startData.error);
        return;
      }

      const { startRegistration } = await import("@simplewebauthn/browser");
      const webAuthnResp = await startRegistration(startData.options);

      const finishResp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "finish-add-passkey",
          userId: user.id,
          response: webAuthnResp,
          challenge: startData.options.challenge,
        }),
      });

      const finishData = await finishResp.json();
      if (finishData.error) {
        setError(finishData.error);
      } else {
        setPasskeyDone(true);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingPasskey(false);
    }
  }, [user]);

  // ---------- Logged-in: personal activity stream ----------
  if (user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("welcome")}{" "}
            <a href={`/users/${user.username}`} className="text-blue-600 hover:underline">
              {user.displayName ?? user.username}
            </a>
          </h1>
          <a
            href="/activities/new"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t("activities.new")}
          </a>
        </div>

        {showAddPasskey && !passkeyDone && supportsPasskey === true && (
          <div className="mt-6 rounded-md bg-blue-50 p-4">
            <p className="text-sm text-blue-800">{t("addPasskeyPrompt")}</p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <button
              onClick={handleAddPasskey}
              disabled={addingPasskey}
              className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {addingPasskey ? t("settingUp") : t("addPasskey")}
            </button>
          </div>
        )}
        {showAddPasskey && !passkeyDone && supportsPasskey === false && (
          <div className="mt-6 rounded-md bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{t("addPasskeyPrompt")}</p>
            <p className="mt-2 text-sm text-amber-600">{t("auth.passkeyNotSupported")}</p>
          </div>
        )}
        {passkeyDone && (
          <div className="mt-6 rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">{t("passkeyAdded")}</p>
          </div>
        )}

        {activities.length === 0 ? (
          <p className="mt-12 text-center text-gray-500">
            {t("home.dashboardEmpty")}
          </p>
        ) : (
          <ul className="mt-8 space-y-4">
            {activities.map((a) => (
              <li key={a.id}>
                <a
                  href={`/activities/${a.id}`}
                  className="block rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
                >
                  <div className="flex gap-4">
                    <div className="w-48 shrink-0">
                      {a.geojson ? (
                        <ClientMap geojson={a.geojson} />
                      ) : (
                        <div className="flex h-36 w-full items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                          {t("routes.noMapPreview")}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <h2 className="text-lg font-medium text-gray-900">{a.name}</h2>
                        <div className="mt-1 flex gap-4 text-sm text-gray-500">
                          {a.distance != null && (
                            <span>{(a.distance / 1000).toFixed(1)} km</span>
                          )}
                          {a.elevationGain != null && (
                            <span>↑ {Math.round(a.elevationGain)} m</span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-gray-400">
                        <ClientDate iso={a.startedAt ?? a.createdAt} />
                      </span>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ---------- Logged-out: visitor home (hero + marketing + public feed) ----------
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Hero. The site name lives in the top banner + nav brand, so the
          h1 carries the product pitch instead to avoid "trails.cool"
          triplication on a narrow strip. */}
      <section>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          {t("home.heroTitle")}
        </h1>
        <p className="mt-4 text-lg text-gray-600">{t("home.heroSubtitle")}</p>

        {/* Primary auth CTAs — the two actions we actually want most
            visitors to take. */}
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="/auth/register"
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t("auth.register")}
          </a>
          <a
            href="/auth/login"
            className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("auth.login")}
          </a>
        </div>
        {/* Demoted escape hatch: the Planner is anonymous and useful
            on its own, but shouldn't compete visually with sign-up. */}
        <p className="mt-3 text-sm text-gray-500">
          {t("home.tryPlannerPrefix")}
          <a href={plannerUrl} className="text-blue-600 hover:underline">
            {t("home.tryPlannerLink")}
          </a>
          {t("home.tryPlannerSuffix")}
        </p>
      </section>

      {/* Marketing blurbs — flagship only. Self-hosted instances link out
          via the "Powered by trails.cool" footer line below the feed.
          Card styling mirrors the Planner's feature grid (emoji icon,
          bordered card) so the two home pages feel consistent. */}
      {isFlagship && (
        <section className="mt-12 grid gap-4 border-t border-gray-200 pt-10 sm:grid-cols-2">
          {[
            { key: "planner", icon: "🗺️" },
            { key: "journal", icon: "📓" },
            { key: "federation", icon: "🌐" },
            { key: "ownership", icon: "🔓" },
          ].map(({ key, icon }) => (
            <div key={key} className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="text-2xl" aria-hidden="true">{icon}</div>
              <h2 className="mt-2 text-base font-semibold text-gray-900">
                {t(`home.marketing.${key}.title`)}
              </h2>
              <p className="mt-1.5 text-sm text-gray-600">
                {t(`home.marketing.${key}.body`)}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Public activity feed */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-gray-900">{t("home.feed.heading")}</h2>

        {activities.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{t("home.feed.empty")}</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {activities.map((a) => (
              <li key={a.id}>
                <a
                  href={`/activities/${a.id}`}
                  className="block rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
                >
                  <div className="flex gap-4">
                    <div className="w-40 shrink-0">
                      {a.geojson ? (
                        <ClientMap geojson={a.geojson} />
                      ) : (
                        <div className="flex h-28 w-full items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                          {t("routes.noMapPreview")}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <h3 className="text-base font-medium text-gray-900">{a.name}</h3>
                        <div className="mt-1 text-sm text-gray-500">
                          {a.ownerUsername && (
                            <>
                              <a
                                href={`/users/${a.ownerUsername}`}
                                className="hover:text-gray-700 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {a.ownerDisplayName ?? a.ownerUsername}
                              </a>
                              {" · "}
                            </>
                          )}
                          <ClientDate iso={a.startedAt ?? a.createdAt} />
                        </div>
                        <div className="mt-1 flex gap-4 text-sm text-gray-500">
                          {a.distance != null && (
                            <span>{(a.distance / 1000).toFixed(1)} km</span>
                          )}
                          {a.elevationGain != null && (
                            <span>↑ {Math.round(a.elevationGain)} m</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Self-hosted instances link back to the flagship for project info.
          Flagship instances already show the marketing section above. */}
      {!isFlagship && (
        <p className="mt-8 text-sm text-gray-500">
          <a
            href="https://trails.cool"
            className="hover:text-gray-700 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("home.poweredBy")}
          </a>
        </p>
      )}
    </div>
  );
}
