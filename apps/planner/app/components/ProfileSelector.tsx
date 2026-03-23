import { useEffect, useState, useCallback } from "react";
import type { YjsState } from "~/lib/use-yjs";

const PROFILES = [
  { id: "trekking", label: "Hiking" },
  { id: "fastbike", label: "Cycling (fast)" },
  { id: "safety", label: "Cycling (safe)" },
  { id: "shortest", label: "Shortest" },
  { id: "car-eco", label: "Car" },
];

interface ProfileSelectorProps {
  yjs: YjsState;
}

export function ProfileSelector({ yjs }: ProfileSelectorProps) {
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
        Profile:
      </label>
      <select
        id="profile"
        value={profile}
        onChange={handleChange}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {PROFILES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}
