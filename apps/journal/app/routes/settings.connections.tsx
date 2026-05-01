import { data, redirect, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/settings.connections";
import { getSessionUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db";
import { syncConnections } from "@trails-cool/db/schema/journal";
import { getAllProviders } from "~/lib/sync/registry";

const KNOWN_ERRORS = ["too_many_tokens", "sync_failed", "generic"] as const;
type KnownError = (typeof KNOWN_ERRORS)[number];
function isKnownError(value: string | null): value is KnownError {
  return value !== null && (KNOWN_ERRORS as readonly string[]).includes(value);
}

export function meta() {
  return [{ title: "Connected services — Settings — trails.cool" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");

  const db = getDb();
  const connections = await db
    .select({
      provider: syncConnections.provider,
      providerUserId: syncConnections.providerUserId,
    })
    .from(syncConnections)
    .where(eq(syncConnections.userId, user.id));

  const providers = getAllProviders().map((p) => {
    const conn = connections.find((c) => c.provider === p.id);
    return { id: p.id, name: p.name, connected: !!conn, providerUserId: conn?.providerUserId };
  });

  return data({ providers });
}

export default function ConnectionsSettings({ loaderData }: Route.ComponentProps) {
  const { providers } = loaderData;
  const { t } = useTranslation(["journal"]);
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get("error");
  const errorKey: KnownError | null = isKnownError(errorParam) ? errorParam : errorParam ? "generic" : null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900">{t("settings.services.title")}</h2>
      {errorKey && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {t(`settings.services.errors.${errorKey}`)}
        </div>
      )}
      <div className="mt-4 space-y-3">
        {providers.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3"
          >
            <div>
              <p className="font-medium text-gray-900">{p.name}</p>
              {p.connected && p.providerUserId && (
                <p className="text-xs text-gray-500">
                  {t("settings.services.connectedAs", { id: p.providerUserId })}
                </p>
              )}
            </div>
            {p.connected ? (
              <div className="flex items-center gap-3">
                <a
                  href={`/sync/import/${p.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {t("sync.import")}
                </a>
                <form method="post" action={`/api/sync/disconnect/${p.id}`}>
                  <button
                    type="submit"
                    className="text-sm text-red-600 hover:underline"
                  >
                    {t("settings.services.disconnect")}
                  </button>
                </form>
              </div>
            ) : (
              <a
                href={`/api/sync/connect/${p.id}`}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                {t("settings.services.connect")}
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
