import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";

const LAST_SEEN_KEY = "changelog:lastSeen";
const DISABLED_KEY = "changelog:disabled";

export function ChangelogLink({
  newestDate,
  className,
}: {
  newestDate: string | null;
  className: (active: boolean) => string;
}) {
  const { t } = useTranslation("journal");
  const location = useLocation();
  const [showDot, setShowDot] = useState(false);
  const isActive =
    location.pathname === "/changelog" ||
    location.pathname.startsWith("/changelog/");

  useEffect(() => {
    if (!newestDate) return;
    const disabled = localStorage.getItem(DISABLED_KEY);
    if (disabled === "true") return;
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
    if (!lastSeen || newestDate > lastSeen) {
      setShowDot(true);
    }
  }, [newestDate]);

  useEffect(() => {
    if (isActive && newestDate) {
      localStorage.setItem(LAST_SEEN_KEY, newestDate);
      setShowDot(false);
    }
  }, [isActive, newestDate]);

  return (
    <Link to="/changelog" className={className(isActive)}>
      {t("nav.changelog")}
      {showDot && (
        <span className="ml-1 inline-block h-2 w-2 rounded-full bg-blue-500" />
      )}
    </Link>
  );
}

export function ChangelogNotificationToggle() {
  const { t } = useTranslation("journal");
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    setDisabled(localStorage.getItem(DISABLED_KEY) === "true");
  }, []);

  function toggle() {
    if (disabled) {
      localStorage.removeItem(DISABLED_KEY);
      setDisabled(false);
    } else {
      localStorage.setItem(DISABLED_KEY, "true");
      setDisabled(true);
    }
  }

  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-500">
      <input
        type="checkbox"
        checked={!disabled}
        onChange={toggle}
        className="rounded border-gray-300"
      />
      {t("changelog.showNotifications")}
    </label>
  );
}
