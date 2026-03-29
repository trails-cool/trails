import { useState, useEffect, useCallback } from "react";
import { data, redirect, useFetcher } from "react-router";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/settings";
import { getSessionUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db";
import { credentials } from "@trails-cool/db/schema/journal";

export function meta() {
  return [{ title: "Settings — trails.cool" }];
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
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      bio: user.bio,
    },
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

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { user, passkeys } = loaderData;
  const { t } = useTranslation("journal");
  const profileFetcher = useFetcher();
  const emailFetcher = useFetcher();
  const deleteFetcher = useFetcher();

  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [profileSaved, setProfileSaved] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const [supportsPasskey, setSupportsPasskey] = useState<boolean | null>(null);
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteUsername, setDeleteUsername] = useState("");

  useEffect(() => {
    import("@simplewebauthn/browser").then(({ browserSupportsWebAuthn }) => {
      setSupportsPasskey(browserSupportsWebAuthn());
    });
  }, []);

  useEffect(() => {
    if (profileFetcher.data && !profileFetcher.data.error) {
      setProfileSaved(true);
      const timer = setTimeout(() => setProfileSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [profileFetcher.data]);

  useEffect(() => {
    if (emailFetcher.data && !emailFetcher.data.error) {
      setEmailSent(true);
    }
  }, [emailFetcher.data]);

  const handleAddPasskey = useCallback(async () => {
    setAddingPasskey(true);
    setPasskeyError(null);

    try {
      const startResp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "add-passkey", userId: user.id }),
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
          userId: user.id,
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
  }, [user.id]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">{t("settings.title")}</h1>

      <nav className="mt-4 flex gap-4 border-b border-gray-200 pb-2">
        <a href="#profile" className="text-sm font-medium text-blue-600 hover:text-blue-800">
          {t("settings.profile.title")}
        </a>
        <a href="#security" className="text-sm font-medium text-blue-600 hover:text-blue-800">
          {t("settings.security.title")}
        </a>
        <a href="#account" className="text-sm font-medium text-blue-600 hover:text-blue-800">
          {t("settings.account.title")}
        </a>
      </nav>

      {/* Profile Section */}
      <section id="profile" className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">{t("settings.profile.title")}</h2>
        <profileFetcher.Form method="post" action="/api/settings/profile" className="mt-4 space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
              {t("settings.profile.displayName")}
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={user.username}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
              {t("settings.profile.bio")}
            </label>
            <textarea
              id="bio"
              name="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">{bio.length}/160</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={profileFetcher.state !== "idle"}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {profileFetcher.state !== "idle" ? t("common.loading") : t("common.save")}
            </button>
            {profileSaved && (
              <p className="text-sm text-green-600">{t("settings.profile.saved")}</p>
            )}
            {profileFetcher.data?.error && (
              <p className="text-sm text-red-600">{profileFetcher.data.error}</p>
            )}
          </div>
        </profileFetcher.Form>
      </section>

      {/* Security Section */}
      <section id="security" className="mt-12">
        <h2 className="text-lg font-semibold text-gray-900">{t("settings.security.title")}</h2>
        <p className="mt-1 text-sm text-gray-600">{t("settings.security.description")}</p>

        <div className="mt-4 space-y-3">
          {passkeys.map((passkey) => (
            <div key={passkey.id} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {transportLabel(passkey.transports, t)}
                </p>
                <p className="text-xs text-gray-500">
                  {t("settings.security.addedOn", {
                    date: new Date(passkey.createdAt).toLocaleDateString(),
                  })}
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
                  {t("common.delete")}
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

      {/* Account Section */}
      <section id="account" className="mt-12">
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
                {t("common.cancel")}
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
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
