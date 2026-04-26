import { useEffect, useState } from "react";
import { Form, Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { Avatar } from "./Avatar";

interface Props {
  user: { username: string; displayName: string | null };
}

// Mobile drawer for the navbar. Replaces the "everything in a row"
// desktop layout with a hamburger trigger and a slide-out panel that
// holds all the same destinations. Bell + the dropdown's account
// section move inside; the bell badge still surfaces on the trigger
// itself via the parent navbar.
export function MobileNavMenu({ user }: Props) {
  const { t } = useTranslation("journal");
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the drawer on navigation. React Router pushes a new location
  // when a Link is followed; this effect picks that up.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const linkClass = (path: string) => {
    const active = location.pathname === path || location.pathname.startsWith(path + "/");
    return `block rounded-md px-3 py-2 text-base font-medium ${
      active ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
    }`;
  };

  return (
    <>
      <button
        type="button"
        aria-label={t("nav.openMenu")}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.75}
          stroke="currentColor"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <button
            type="button"
            aria-label={t("nav.closeMenu")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          {/* Panel */}
          <div
            role="dialog"
            aria-modal="true"
            className="absolute right-0 top-0 flex h-full w-72 max-w-[85%] flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar displayName={user.displayName} username={user.username} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {user.displayName ?? user.username}
                  </p>
                  <p className="truncate text-xs text-gray-500">@{user.username}</p>
                </div>
              </div>
              <button
                type="button"
                aria-label={t("nav.closeMenu")}
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.75}
                  stroke="currentColor"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
              <Link to="/feed" className={linkClass("/feed")}>
                {t("social.feed.title")}
              </Link>
              <Link to="/explore" className={linkClass("/explore")}>
                {t("nav.explore")}
              </Link>
              <Link to="/routes" className={linkClass("/routes")}>
                {t("nav.routes")}
              </Link>
              <Link to="/activities" className={linkClass("/activities")}>
                {t("nav.activities")}
              </Link>
              <Link to="/notifications" className={linkClass("/notifications")}>
                {t("notifications.title")}
              </Link>
              <hr className="my-2 border-gray-200" />
              <Link to={`/users/${user.username}`} className={linkClass(`/users/${user.username}`)}>
                {t("nav.profile")}
              </Link>
              <Link to="/settings" className={linkClass("/settings")}>
                {t("nav.settings")}
              </Link>
              <Form method="post" action="/auth/logout">
                <button
                  type="submit"
                  className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t("nav.logout")}
                </button>
              </Form>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
