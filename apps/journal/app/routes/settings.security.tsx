import { useState, useEffect, useCallback } from "react";
import { data, redirect, useFetcher } from "react-router";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/settings.security";
import { getSessionUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db";
import { credentials } from "@trails-cool/db/schema/journal";
import { ClientDate } from "~/components/ClientDate";

export function meta() {
  return [{ title: "Security — Settings — trails.cool" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");

  const db = getDb();
  const passkeys = await db
    .select({
      id: credentials.id,
      deviceType: credentials.deviceType,
      transports: credentials.transports,
      createdAt: credentials.createdAt,
    })
    .from(credentials)
    .where(eq(credentials.userId, user.id));

  return data({
    userId: user.id,
    passkeys: passkeys.map((p) => ({
      id: p.id,
      deviceType: p.deviceType,
      transports: p.transports as string[] | null,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

function transportLabel(transports: string[] | null, t: (key: string) => string): string {
  if (!transports || transports.length === 0) return t("settings.security.passkey");
  if (transports.includes("internal")) return t("settings.security.thisDevice");
  if (transports.includes("usb")) return t("settings.security.securityKey");
  if (transports.includes("ble")) return t("settings.security.bluetooth");
  if (transports.includes("hybrid")) return t("settings.security.phoneOrTablet");
  return t("settings.security.passkey");
}

export default function SecuritySettings({ loaderData }: Route.ComponentProps) {
  const { userId, passkeys } = loaderData;
  const { t } = useTranslation(["journal", "common"]);
  const deleteFetcher = useFetcher();

  const [supportsPasskey, setSupportsPasskey] = useState<boolean | null>(null);
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  useEffect(() => {
    import("@simplewebauthn/browser").then(({ browserSupportsWebAuthn }) => {
      setSupportsPasskey(browserSupportsWebAuthn());
    });
  }, []);

  const handleAddPasskey = useCallback(async () => {
    setAddingPasskey(true);
    setPasskeyError(null);

    try {
      const startResp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "add-passkey", userId }),
      });
      const startData = await startResp.json();
      if (startData.error) {
        setPasskeyError(startData.error);
        return;
      }

      const { startRegistration } = await import("@simplewebauthn/browser");
      const webAuthnResp = await startRegistration(startData.options);

      const finishResp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "finish-add-passkey",
          userId,
          response: webAuthnResp,
          challenge: startData.options.challenge,
        }),
      });

      const finishData = await finishResp.json();
      if (finishData.error) {
        setPasskeyError(finishData.error);
      } else {
        window.location.reload();
      }
    } catch (err) {
      setPasskeyError((err as Error).message);
    } finally {
      setAddingPasskey(false);
    }
  }, [userId]);

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900">{t("settings.security.title")}</h2>
      <p className="mt-1 text-sm text-gray-600">{t("settings.security.description")}</p>

      <div className="mt-4 space-y-3">
        {passkeys.map((passkey) => (
          <div
            key={passkey.id}
            className="flex items-center justify-between rounded-md border border-gray-200 p-3"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">
                {transportLabel(passkey.transports, t)}
              </p>
              <p className="text-xs text-gray-500">
                {t("settings.security.addedOn", { date: "" })}
                <ClientDate iso={passkey.createdAt} />
              </p>
            </div>
            <deleteFetcher.Form
              method="post"
              action="/api/settings/passkey/delete"
              onSubmit={(e) => {
                const isLast = passkeys.length === 1;
                const msg = isLast
                  ? t("settings.security.deleteLastWarning")
                  : t("settings.security.deleteConfirm");
                if (!confirm(msg)) e.preventDefault();
              }}
            >
              <input type="hidden" name="credentialId" value={passkey.id} />
              <button
                type="submit"
                className="text-sm text-red-600 hover:text-red-800"
              >
                {t("common:delete")}
              </button>
            </deleteFetcher.Form>
          </div>
        ))}

        {passkeys.length === 0 && (
          <p className="text-sm text-gray-500">{t("settings.security.noPasskeys")}</p>
        )}
      </div>

      {passkeyError && (
        <p className="mt-2 text-sm text-red-600">{passkeyError}</p>
      )}

      {supportsPasskey === true && (
        <button
          onClick={handleAddPasskey}
          disabled={addingPasskey}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {addingPasskey ? t("settingUp") : t("settings.security.addPasskey")}
        </button>
      )}

      {supportsPasskey === false && (
        <p className="mt-4 text-sm text-amber-700">{t("auth.passkeyNotSupported")}</p>
      )}
    </section>
  );
}
