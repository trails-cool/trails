import { useEffect, useRef, useState } from "react";
import { Form, Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Avatar } from "./Avatar";

interface Props {
  user: { username: string; displayName: string | null };
}

export function AccountDropdown({ user }: Props) {
  const { t } = useTranslation("journal");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click-outside + Escape close. Mounted only while open to keep the
  // listener cost zero in the steady state.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user.displayName ?? user.username}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <Avatar displayName={user.displayName} username={user.username} size="md" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-56 origin-top-right rounded-md border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5"
        >
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="truncate text-sm font-medium text-gray-900">
              {user.displayName ?? user.username}
            </p>
            <p className="truncate text-xs text-gray-500">@{user.username}</p>
          </div>
          <Link
            to={`/users/${user.username}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {t("nav.profile")}
          </Link>
          <Link
            to="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {t("nav.settings")}
          </Link>
          <Form method="post" action="/auth/logout">
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              {t("nav.logout")}
            </button>
          </Form>
        </div>
      )}
    </div>
  );
}
