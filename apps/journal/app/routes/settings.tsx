import { Outlet, redirect } from "react-router";
import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/settings";
import { getSessionUser } from "~/lib/auth.server";

export function meta() {
  return [{ title: "Settings — trails.cool" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/auth/login");
  return { username: user.username };
}

interface NavItem {
  to: string;
  labelKey: string;
}

const NAV: NavItem[] = [
  { to: "/settings/profile", labelKey: "settings.nav.profile" },
  { to: "/settings/account", labelKey: "settings.nav.account" },
  { to: "/settings/security", labelKey: "settings.nav.security" },
  { to: "/settings/connections", labelKey: "settings.nav.connections" },
];

export default function SettingsLayout() {
  const { t } = useTranslation("journal");
  const location = useLocation();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">{t("settings.title")}</h1>

      <div className="mt-6 grid gap-8 md:grid-cols-[200px_1fr]">
        <nav className="flex flex-col gap-1 border-r border-gray-200 md:pr-4">
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
