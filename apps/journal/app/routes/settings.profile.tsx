import { useState, useEffect } from "react";
import { data, redirect, useFetcher } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/settings.profile";
import { getSessionUser } from "~/lib/auth.server";

export function meta() {
  return [{ title: "Profile — Settings — trails.cool" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");
  return data({
    user: {
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      profileVisibility: user.profileVisibility,
    },
  });
}

export default function ProfileSettings({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const { t } = useTranslation(["journal", "common"]);
  const profileFetcher = useFetcher();

  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [profileVisibility, setProfileVisibility] = useState<"public" | "private">(
    user.profileVisibility,
  );
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    if (profileFetcher.data && !profileFetcher.data.error) {
      setProfileSaved(true);
      const timer = setTimeout(() => setProfileSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [profileFetcher.data]);

  return (
    <section>
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
        <fieldset>
          <legend className="block text-sm font-medium text-gray-700">
            {t("settings.profile.visibility.label")}
          </legend>
          <div className="mt-2 space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="profileVisibility"
                value="public"
                checked={profileVisibility === "public"}
                onChange={() => setProfileVisibility("public")}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-gray-900">
                  {t("settings.profile.visibility.public")}
                </span>
                <span className="ml-2 text-gray-500">
                  {t("settings.profile.visibility.publicHelp")}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="profileVisibility"
                value="private"
                checked={profileVisibility === "private"}
                onChange={() => setProfileVisibility("private")}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-gray-900">
                  {t("settings.profile.visibility.private")}
                </span>
                <span className="ml-2 text-gray-500">
                  {t("settings.profile.visibility.privateHelp")}
                </span>
              </span>
            </label>
          </div>
        </fieldset>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={profileFetcher.state !== "idle"}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {profileFetcher.state !== "idle" ? t("common:loading") : t("common:save")}
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
  );
}
