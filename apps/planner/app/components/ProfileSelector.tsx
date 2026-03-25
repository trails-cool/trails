import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { YjsState } from "~/lib/use-yjs";

const PROFILE_IDS = ["trekking", "fastbike", "safety", "shortest", "car"] as const;

interface ProfileSelectorProps {
  yjs: YjsState;
}

export function ProfileSelector({ yjs }: ProfileSelectorProps) {
  const { t } = useTranslation("planner");
  const [profile, setProfile] = useState("trekking");

  useEffect(() => {
    const update = () => {
      const p = yjs.routeData.get("profile") as string | undefined;
      if (p) setProfile(p);
    };
    yjs.routeData.observe(update);
    update();
    return () => yjs.routeData.unobserve(update);
  }, [yjs.routeData]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      setProfile(value);
      yjs.routeData.set("profile", value);
    },
    [yjs.routeData],
  );

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="profile" className="text-sm text-gray-600">
        {t("profile")}:
      </label>
      <select
        id="profile"
        value={profile}
        onChange={handleChange}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {PROFILE_IDS.map((id) => (
          <option key={id} value={id}>
            {t(`profiles.${id}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
