import { useEffect } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useLocation, Form, Link } from "react-router";
import type { LinksFunction } from "react-router";
import type { Route } from "./+types/root";
import * as Sentry from "@sentry/react";
import { useTranslation } from "react-i18next";
import { detectLocale } from "@trails-cool/i18n";
import { getSessionUser } from "~/lib/auth.server";
import { LocaleProvider } from "~/components/LocaleContext";
import stylesheet from "@trails-cool/ui/styles.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: stylesheet }];

export function Layout({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  return (
    <html lang={i18n.language}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-gray-50">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  const locale = detectLocale(request);
  return { user: user ? { id: user.id, username: user.username } : null, locale };
}

function NavBar({ user }: { user: { id: string; username: string } | null }) {
  const { t } = useTranslation("journal");
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const linkClass = (path: string) =>
    `text-sm font-medium ${
      isActive(path)
        ? "text-blue-600"
        : "text-gray-600 hover:text-gray-900"
    }`;

  return (
    <nav className="border-b border-gray-200 bg-white px-4 py-2">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-semibold text-gray-900">
            {t("title")}
          </Link>
          {user && (
            <>
              <Link to="/routes" className={linkClass("/routes")}>
                {t("nav.routes")}
              </Link>
              <Link to="/activities" className={linkClass("/activities")}>
                {t("nav.activities")}
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                to={`/users/${user.username}`}
                className={linkClass(`/users/${user.username}`)}
              >
                {user.username}
              </Link>
              <Link to="/settings" className={linkClass("/settings")}>
                {t("nav.settings")}
              </Link>
              <Form method="post" action="/auth/logout">
                <button
                  type="submit"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  {t("nav.logout")}
                </button>
              </Form>
            </>
          ) : (
            <>
              <Link to="/auth/login" className={linkClass("/auth/login")}>
                {t("nav.login")}
              </Link>
              <Link
                to="/auth/register"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t("nav.register")}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  const user = loaderData?.user;
  const locale = loaderData?.locale ?? "en";
  useEffect(() => {
    if (user) {
      Sentry.setUser({ id: user.id, username: user.username });
    } else {
      Sentry.setUser(null);
    }
  }, [user]);

  return (
    <LocaleProvider locale={locale}>
      <NavBar user={user ?? null} />
      <Outlet />
    </LocaleProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // Don't report expected HTTP errors (404, 403) to Sentry
  if (!(isRouteErrorResponse(error) && error.status < 500)) {
    Sentry.captureException(error);
  }
  const { t } = useTranslation();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900">{error.status}</h1>
        <p className="mt-2 text-gray-600">
          {error.status === 404 && t("pageNotFound")}
          {error.status === 503 && t("serviceUnavailable")}
          {error.status !== 404 && error.status !== 503 && (error.statusText || t("error"))}
        </p>
        <a href="/" className="mt-6 inline-block text-blue-600 hover:underline">
          {t("goHome")}
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-4xl font-bold text-gray-900">{t("error")}</h1>
      <p className="mt-2 text-gray-600">
        {error instanceof Error ? error.message : t("error")}
      </p>
      <a href="/" className="mt-6 inline-block text-blue-600 hover:underline">
        {t("goHome")}
      </a>
    </div>
  );
}
