import { useState, useCallback } from "react";
import { data } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/home";
import { getSessionUser } from "~/lib/auth.server";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "trails.cool" },
    { name: "description", content: "Your outdoor activity journal" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  const url = new URL(request.url);
  const showAddPasskey = url.searchParams.get("add-passkey") === "1" && user !== null;
  return data({
    user: user ? { id: user.id, username: user.username, displayName: user.displayName } : null,
    showAddPasskey,
  });
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user, showAddPasskey } = loaderData;
  const { t } = useTranslation("journal");
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [passkeyDone, setPasskeyDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddPasskey = useCallback(async () => {
    if (!user) return;
    setAddingPasskey(true);
    setError(null);

    try {
      // Get registration options for existing user
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-4xl font-bold text-gray-900">{t("title")}</h1>
      <p className="mt-4 text-lg text-gray-600">{t("subtitle")}</p>

      {user ? (
        <div className="mt-8">
          <p className="text-gray-700">
            {t("welcome")} <a href={`/users/${user.username}`} className="text-blue-600 hover:underline">{user.displayName ?? user.username}</a>
          </p>

          {showAddPasskey && !passkeyDone && (
            <div className="mt-6 rounded-md bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                {t("addPasskeyPrompt")}
              </p>
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

          {passkeyDone && (
            <div className="mt-6 rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-800">
                {t("passkeyAdded")}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-8 flex gap-4">
          <a
            href="/auth/register"
            className="rounded-md bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            {t("auth.register")}
          </a>
          <a
            href="/auth/login"
            className="rounded-md border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50"
          >
            {t("auth.login")}
          </a>
        </div>
      )}

      <footer className="mt-16 border-t border-gray-200 pt-6">
        <a href="/privacy" className="text-sm text-gray-400 hover:text-gray-600">
          Privacy
        </a>
      </footer>
    </div>
  );
}
