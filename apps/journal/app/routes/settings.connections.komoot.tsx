// Komoot connection management page. Supports two modes:
//   Public    — verify ownership via bio link (no password stored)
//   Authenticated — email + password (password encrypted at rest)

import { useState } from "react";
import { data, useFetcher } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/settings.connections.komoot";
import { loadKomootConnection } from "./settings.connections.komoot.server";

export function meta() {
  return [{ title: "Connect Komoot — Settings — trails.cool" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  return data(await loadKomootConnection(request));
}

type VerifyResponse = { success?: boolean; error?: string };
type ConnectResponse = { success?: boolean; error?: string };

export default function KomootConnectPage({ loaderData }: Route.ComponentProps) {
  const { connected, mode, providerUserId, serviceId, trailsProfileUrl } = loaderData;
  const { t } = useTranslation("journal");

  const verifyFetcher = useFetcher<VerifyResponse>();
  const connectFetcher = useFetcher<ConnectResponse>();

  const [komootProfileUrl, setKomootProfileUrl] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isVerifying = verifyFetcher.state !== "idle";
  const isConnecting = connectFetcher.state !== "idle";

  const verifyError = verifyFetcher.data?.error;
  const connectError = connectFetcher.data?.error;

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    verifyFetcher.submit(
      JSON.stringify({ komootProfileUrl }),
      { method: "post", action: "/api/sync/komoot/verify", encType: "application/json" },
    );
  }

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    connectFetcher.submit(
      JSON.stringify({ email, password }),
      { method: "post", action: "/api/sync/komoot/connect", encType: "application/json" },
    );
  }

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{t("komoot.title")}</h2>
        {connected && (
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              {t("komoot.modeBadge", { mode: mode === "public" ? t("komoot.publicMode") : t("komoot.authenticatedMode") })}
            </span>
            {providerUserId && (
              <span className="text-xs text-gray-500">
                {t("settings.services.connectedAs", { id: providerUserId })}
              </span>
            )}
            <a
              href="/sync/import/komoot"
              className="text-sm text-blue-600 hover:underline"
            >
              {t("sync.import")}
            </a>
            {serviceId && (
              <form method="post" action={`/api/sync/disconnect/komoot`}>
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  {t("settings.services.disconnect")}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {verifyFetcher.data?.success && (
        <div role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {t("komoot.verifySuccess")}
        </div>
      )}
      {connectFetcher.data?.success && (
        <div role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {t("komoot.connectSuccess")}
        </div>
      )}

      {/* Public mode section */}
      <div className="rounded-md border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900">{t("komoot.publicSection")}</h3>
        <p className="mt-1 text-sm text-gray-600">
          {t("komoot.publicInstructions")}
        </p>
        <div className="mt-2 rounded-md bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800 select-all">
          {trailsProfileUrl}
        </div>
        <form onSubmit={handleVerify} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="komoot-profile-url" className="block text-sm font-medium text-gray-700">
              {t("komoot.profileUrlLabel")}
            </label>
            <input
              id="komoot-profile-url"
              type="text"
              value={komootProfileUrl}
              onChange={(e) => setKomootProfileUrl(e.target.value)}
              placeholder={t("komoot.profileUrlPlaceholder")}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isVerifying}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isVerifying ? t("komoot.verifying") : t("komoot.verifyButton")}
          </button>
        </form>
        {verifyError && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {verifyError === "not_verified"
              ? t("komoot.verificationError")
              : verifyError === "invalid_url"
                ? t("komoot.invalidUrl")
                : t("komoot.verificationError")}
          </p>
        )}
        {isVerifying && (
          <p className="mt-2 text-sm text-gray-500">{t("komoot.verifyPending")}</p>
        )}
      </div>

      {/* Authenticated mode section */}
      <div className="rounded-md border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900">{t("komoot.authenticatedSection")}</h3>
        <form onSubmit={handleConnect} className="mt-4 flex flex-col gap-3">
          <div>
            <label htmlFor="komoot-email" className="block text-sm font-medium text-gray-700">
              {t("komoot.emailLabel")}
            </label>
            <input
              id="komoot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="komoot-password" className="block text-sm font-medium text-gray-700">
              {t("komoot.passwordLabel")}
            </label>
            <input
              id="komoot-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isConnecting}
            className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isConnecting ? t("komoot.connecting") : t("komoot.connectButton")}
          </button>
        </form>
        {connectError && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {connectError === "invalid_credentials"
              ? t("komoot.authError")
              : t("komoot.authError")}
          </p>
        )}
      </div>
    </section>
  );
}
