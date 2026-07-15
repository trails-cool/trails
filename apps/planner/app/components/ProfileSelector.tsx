import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "@trails-cool/ui";
import type { YjsState } from "~/lib/use-yjs";
import { DEFAULT_PROFILE, getProfile, setProfile as setYjsProfile } from "~/lib/route-data";

const PROFILE_IDS = ["fastbike", "safety", "shortest", "car", "trekking"] as const;

interface ProfileSelectorProps {
  yjs: YjsState;
}

export function ProfileSelector({ yjs }: ProfileSelectorProps) {
  const { t } = useTranslation("planner");
  const [profile, setProfile] = useState(DEFAULT_PROFILE);

  useEffect(() => {
    const update = () => {
      const p = getProfile(yjs.routeData);
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
      setYjsProfile(yjs.routeData, value);
    },
    [yjs.routeData],
  );

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="profile" className="hidden text-sm text-text-md sm:block">
        {t("profile")}:
      </label>
      <Select
        id="profile"
        size="sm"
        value={profile}
        onChange={handleChange}
      >
        {PROFILE_IDS.map((id) => (
          <option key={id} value={id}>
            {t(`profiles.${id}`)}
          </option>
        ))}
      </Select>
    </div>
  );
}
