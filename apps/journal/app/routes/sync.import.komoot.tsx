// Komoot import page — shows live progress for background bulk imports
// and lets the user trigger a new import run.

import { useEffect, useRef } from "react";
import { data, useFetcher, useRevalidator } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/sync.import.komoot";
import { loadKomootImport, komootImportAction } from "./sync.import.komoot.server";

export function meta() {
  return [{ title: "Import from Komoot — trails.cool" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  return data(await loadKomootImport(request));
}

export async function action({ request }: Route.ActionArgs) {
  return await komootImportAction(request);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function KomootImportPage({ loaderData }: Route.ComponentProps) {
  const { batch } = loaderData;
  const { t } = useTranslation("journal");
  const revalidator = useRevalidator();
  const triggerFetcher = useFetcher<{ error?: string }>();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = batch?.status === "pending" || batch?.status === "running";

  useEffect(() => {
    if (isActive) {
      pollingRef.current = setInterval(() => {
        revalidator.revalidate();
      }, 2000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isActive]);

  const elapsedSeconds = batch
    ? Math.floor(
        (batch.completedAt
          ? new Date(batch.completedAt).getTime()
          : Date.now()) - new Date(batch.startedAt).getTime(),
      ) / 1000
    : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">
        {t("sync.importFrom", { provider: "Komoot" })}
      </h1>

      <div className="mt-6 rounded-lg border border-gray-200 p-6">
        {!batch && (
          <div className="text-center">
            <p className="text-gray-600">{t("komoot.import.noImportYet")}</p>
            <triggerFetcher.Form method="post" className="mt-4">
              <button
                type="submit"
                disabled={triggerFetcher.state !== "idle"}
                className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {triggerFetcher.state !== "idle"
                  ? t("komoot.import.starting")
                  : t("komoot.import.startImport")}
              </button>
            </triggerFetcher.Form>
          </div>
        )}

        {batch && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={batch.status} t={t} />
              {(batch.status === "completed" || batch.status === "failed") && (
                <triggerFetcher.Form method="post">
                  <button
                    type="submit"
                    disabled={triggerFetcher.state !== "idle"}
                    className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                  >
                    {t("komoot.import.runAgain")}
                  </button>
                </triggerFetcher.Form>
              )}
            </div>

            {isActive && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                  style={{
                    width: batch.totalFound > 0
                      ? `${Math.round(((batch.importedCount + batch.duplicateCount) / batch.totalFound) * 100)}%`
                      : "5%",
                  }}
                />
              </div>
            )}

            <dl className="grid grid-cols-3 gap-4 text-center">
              <StatBox label={t("komoot.import.found")} value={batch.totalFound} />
              <StatBox label={t("komoot.import.imported")} value={batch.importedCount} />
              <StatBox label={t("komoot.import.skipped")} value={batch.duplicateCount} />
            </dl>

            {batch.status === "completed" && (
              <p className="text-sm text-gray-500">
                {t("komoot.import.completedIn", { duration: formatDuration(elapsedSeconds) })}
              </p>
            )}

            {batch.status === "failed" && batch.errorMessage && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {batch.errorMessage}
              </p>
            )}
          </div>
        )}
      </div>

      {batch?.status === "completed" && (
        <p className="mt-4 text-center text-sm text-gray-500">
          <a href={`/users/me`} className="text-blue-600 hover:underline">
            {t("komoot.import.viewActivities")}
          </a>
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const styles: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600",
    running: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-medium ${styles[status] ?? styles.pending}`}>
      {t(`komoot.import.status.${status}`)}
    </span>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 py-3">
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-gray-500">{label}</p>
    </div>
  );
}
