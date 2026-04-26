import { useState, useEffect } from "react";
import { data, redirect, useFetcher } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/settings.account";
import { getSessionUser } from "~/lib/auth.server";

export function meta() {
  return [{ title: "Account — Settings — trails.cool" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");
  return data({
    user: {
      username: user.username,
      email: user.email,
    },
  });
}

export default function AccountSettings({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const { t } = useTranslation(["journal", "common"]);
  const emailFetcher = useFetcher();

  const [newEmail, setNewEmail] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteUsername, setDeleteUsername] = useState("");

  useEffect(() => {
    if (emailFetcher.data && !emailFetcher.data.error) {
      setEmailSent(true);
    }
  }, [emailFetcher.data]);

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900">{t("settings.account.title")}</h2>

      {/* Email */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">{t("auth.email")}</label>
        <div className="mt-1 flex items-center gap-3">
          <p className="text-sm text-gray-900">{user.email}</p>
          {!showEmailForm && !emailSent && (
            <button
              onClick={() => setShowEmailForm(true)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {t("settings.account.changeEmail")}
            </button>
          )}
        </div>

        {showEmailForm && !emailSent && (
          <emailFetcher.Form method="post" action="/api/settings/email" className="mt-2 flex gap-2">
            <input
              name="newEmail"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t("settings.account.newEmailPlaceholder")}
              className="block flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={emailFetcher.state !== "idle"}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {t("settings.account.sendVerification")}
            </button>
            <button
              type="button"
              onClick={() => { setShowEmailForm(false); setNewEmail(""); }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t("common:cancel")}
            </button>
          </emailFetcher.Form>
        )}

        {emailFetcher.data?.error && (
          <p className="mt-2 text-sm text-red-600">{emailFetcher.data.error}</p>
        )}

        {emailSent && (
          <p className="mt-2 text-sm text-green-600">{t("settings.account.verificationSent")}</p>
        )}
      </div>

      {/* Delete Account */}
      <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4">
        <h3 className="text-sm font-semibold text-red-800">{t("settings.account.dangerZone")}</h3>
        <p className="mt-1 text-sm text-red-700">{t("settings.account.deleteDescription")}</p>

        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="mt-3 rounded-md border border-red-300 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            {t("settings.account.deleteAccount")}
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-red-800">
              {t("settings.account.deleteConfirmPrompt", { username: user.username })}
            </p>
            <input
              type="text"
              value={deleteUsername}
              onChange={(e) => setDeleteUsername(e.target.value)}
              placeholder={user.username}
              className="block w-full rounded-md border border-red-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <form method="post" action="/api/settings/delete-account">
                <button
                  type="submit"
                  disabled={deleteUsername !== user.username}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {t("settings.account.confirmDelete")}
                </button>
              </form>
              <button
                onClick={() => { setDeleteConfirm(false); setDeleteUsername(""); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {t("common:cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
