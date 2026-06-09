import { data, Form, Link, useNavigation } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/sync.import.garmin";
import { ClientDate } from "~/components/ClientDate";

export function meta() {
  return [{ title: "Garmin import — trails.cool" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { loadGarminImportPage } = await import("./sync.import.garmin.server");
  return data(await loadGarminImportPage(request));
}

export async function action({ request }: Route.ActionArgs) {
  const { handleGarminBackfillAction } = await import("./sync.import.garmin.server");
  return data(await handleGarminBackfillAction(request));
}

export default function GarminImport({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useTranslation(["journal"]);
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  if (!loaderData.connected) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("sync.garmin.title")}</h1>
        <p className="mt-4 text-sm text-gray-600">{t("sync.garmin.notConnected")}</p>
        <Link to="/settings/connections" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
          {t("sync.garmin.goConnect")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">{t("sync.garmin.title")}</h1>
      <p className="mt-2 text-sm text-gray-600">{t("sync.garmin.subtitle")}</p>

      {loaderData.status !== "active" && (
        <div role="alert" className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("sync.garmin.needsRelink")}
        </div>
      )}

      <Form method="post" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="text-gray-700">{t("sync.garmin.from")}</span>
          <input
            type="date"
            name="from"
            required
            className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">{t("sync.garmin.to")}</span>
          <input
            type="date"
            name="to"
            required
            className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={busy || loaderData.status !== "active"}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? t("sync.garmin.requesting") : t("sync.garmin.request")}
        </button>
      </Form>

      {actionData && "ok" in actionData && actionData.ok && (
        <p className="mt-3 text-sm text-green-700">{t("sync.garmin.requested")}</p>
      )}
      {actionData && "ok" in actionData && !actionData.ok && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {t(`sync.garmin.errors.${actionData.error}`)}
        </p>
      )}

      <p className="mt-6 text-xs text-gray-500">{t("sync.garmin.asyncNote")}</p>

      {loaderData.batches.length > 0 && (
        <ul className="mt-4 space-y-2">
          {loaderData.batches.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3 text-sm"
            >
              <span className="text-gray-900">
                {b.rangeStart && b.rangeEnd ? (
                  <>
                    <ClientDate iso={b.rangeStart} /> – <ClientDate iso={b.rangeEnd} />
                  </>
                ) : (
                  <ClientDate iso={b.requestedAt} />
                )}
              </span>
              <span className="text-gray-500">
                {t("sync.garmin.importedSince", { count: b.importedSince })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
