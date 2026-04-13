import { useState, useEffect } from "react";
import { data, redirect, useFetcher } from "react-router";
import { useTranslation } from "react-i18next";
import { eq, and } from "drizzle-orm";
import type { Route } from "./+types/integrations";
import { getSessionUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db";
import { syncConnections } from "@trails-cool/db/schema/journal";

export function meta() {
  return [{ title: "Integrations — trails.cool" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");

  const db = getDb();
  const [komoot] = await db
    .select({
      id: syncConnections.id,
      providerUserId: syncConnections.providerUserId,
      createdAt: syncConnections.createdAt,
    })
    .from(syncConnections)
    .where(
      and(
        eq(syncConnections.userId, user.id),
        eq(syncConnections.provider, "komoot"),
      ),
    );

  return data({ komoot: komoot ?? null });
}

function KomootConnect() {
  const { t } = useTranslation("journal");
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";
  const error = (fetcher.data as { error?: string } | undefined)?.error;

  return (
    <fetcher.Form method="post" action="/api/integrations/komoot/connect" className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          {t("integrations.komoot.email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          {t("integrations.komoot.password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
        <p className="font-medium">{t("integrations.komoot.whyPasswordTitle")}</p>
        <p className="mt-1">{t("integrations.komoot.whyPasswordBody")}</p>
        <p className="mt-1">{t("integrations.komoot.howStored")}</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? t("common.loading") : t("integrations.komoot.connect")}
      </button>
    </fetcher.Form>
  );
}

function KomootConnected({ username, createdAt }: { username: string; createdAt: string }) {
  const { t } = useTranslation("journal");
  const disconnectFetcher = useFetcher();
  const importFetcher = useFetcher();
  const [batch, setBatch] = useState<{
    status: string;
    totalFound: number;
    importedCount: number;
    duplicateCount: number;
  } | null>(null);
  const [polling, setPolling] = useState(false);

  const isImporting = importFetcher.state !== "idle" || (batch?.status === "running");

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      const res = await fetch("/api/integrations/komoot/import-status");
      const { batch: b } = await res.json() as { batch: typeof batch };
      if (b) {
        setBatch(b);
        if (b.status !== "running") setPolling(false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [polling]);

  function handleImport() {
    importFetcher.submit(null, {
      method: "post",
      action: "/api/integrations/komoot/import",
    });
    setPolling(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
        <span className="text-sm text-gray-700">
          {t("integrations.komoot.connectedAs", { username })}
        </span>
        <span className="text-xs text-gray-400">
          {t("integrations.komoot.since", { date: new Date(createdAt).toLocaleDateString() })}
        </span>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleImport}
          disabled={isImporting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isImporting ? t("integrations.importing") : t("integrations.import")}
        </button>
        <disconnectFetcher.Form method="post" action="/api/integrations/komoot/disconnect">
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("integrations.disconnect")}
          </button>
        </disconnectFetcher.Form>
      </div>

      {batch && (
        <div className="rounded-md bg-gray-50 p-4 text-sm">
          <p className="font-medium">
            {batch.status === "running"
              ? t("integrations.importRunning")
              : batch.status === "completed"
                ? t("integrations.importComplete")
                : t("integrations.importFailed")}
          </p>
          <ul className="mt-2 space-y-1 text-gray-600">
            <li>{t("integrations.totalFound", { count: batch.totalFound })}</li>
            <li>{t("integrations.importedCount", { count: batch.importedCount })}</li>
            <li>{t("integrations.duplicateCount", { count: batch.duplicateCount })}</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("journal");
  const { komoot } = loaderData;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">{t("integrations.title")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("integrations.subtitle")}</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Komoot</h2>
        <p className="mt-1 text-sm text-gray-500">{t("integrations.komoot.description")}</p>
        <div className="mt-4">
          {komoot ? (
            <KomootConnected
              username={komoot.providerUserId!}
              createdAt={komoot.createdAt.toISOString()}
            />
          ) : (
            <KomootConnect />
          )}
        </div>
      </section>
    </div>
  );
}
