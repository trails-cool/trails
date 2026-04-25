import { useEffect } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useLocation, Form, Link, redirect } from "react-router";
import type { LinksFunction } from "react-router";
import type { Route } from "./+types/root";
import * as Sentry from "@sentry/react";
import { useTranslation } from "react-i18next";
import { detectLocale } from "@trails-cool/i18n";
import { getSessionUser } from "~/lib/auth.server";
import { LocaleProvider } from "~/components/LocaleContext";
import { AlphaBanner } from "~/components/AlphaBanner";
import { useUnreadNotifications } from "~/hooks/useUnreadNotifications";
import { Footer } from "~/components/Footer";
import { initSentryClient, stopSentryClient } from "~/lib/sentry.client";
import { TERMS_VERSION } from "~/lib/legal";
import stylesheet from "@trails-cool/ui/styles.css?url";

// Paths that must stay reachable even when the user has a stale
// terms_version, so they can read the Terms, accept them, or log out.
const TERMS_GATE_ALLOWLIST = [
  "/auth/accept-terms",
  "/auth/logout",
  "/legal/",
];

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

  // Gate logged-in users with stale / missing terms_version: send them to the
  // re-accept page on any request that isn't already on an allow-listed path.
  if (user && user.termsVersion !== TERMS_VERSION) {
    const pathname = new URL(request.url).pathname;
    const onAllowlistedPath = TERMS_GATE_ALLOWLIST.some((p) =>
      p.endsWith("/") ? pathname.startsWith(p) : pathname === p,
    );
    if (!onAllowlistedPath) {
      const returnTo = encodeURIComponent(pathname + new URL(request.url).search);
      throw redirect(`/auth/accept-terms?returnTo=${returnTo}`);
    }
  }

  // Pending follow-request count for the navbar badge. Cheap (a single
  // `count(*) WHERE accepted_at IS NULL`); only computed for signed-in
  // users. Hidden behind a dynamic import so the root layout doesn't
  // pull in the follow module on anonymous renders.
  let pendingFollowRequests = 0;
  let unreadNotifications = 0;
  if (user) {
    const { countPendingFollowRequests } = await import("./lib/follow.server.ts");
    const { countUnread } = await import("./lib/notifications.server.ts");
    [pendingFollowRequests, unreadNotifications] = await Promise.all([
      countPendingFollowRequests(user.id),
      countUnread(user.id),
    ]);
  }

  return {
    user: user ? { id: user.id, username: user.username } : null,
    locale,
    pendingFollowRequests,
    unreadNotifications,
  };
}

function NavBar({
  user,
  pendingFollowRequests,
  unreadNotifications,
}: {
  user: { id: string; username: string } | null;
  pendingFollowRequests: number;
  unreadNotifications: number;
}) {
  const { t } = useTranslation("journal");
  const location = useLocation();
  // Live-updating unread count for the navbar badge. Loader value is
  // the SSR baseline; SSE pushes overrides after first event.
  const liveUnread = useUnreadNotifications(unreadNotifications, user !== null);

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
              <Link to="/feed" className={linkClass("/feed")}>
                {t("social.feed.title")}
              </Link>
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
                to="/notifications"
                className={`relative inline-flex items-center ${linkClass("/notifications")}`}
                aria-label={t("notifications.title")}
                title={t("notifications.title")}
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                  />
                </svg>
                {liveUnread > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                    {liveUnread}
                  </span>
                )}
              </Link>
              <Link
                to="/follows/requests"
                className={`relative ${linkClass("/follows/requests")}`}
                title={t("social.requests.title")}
              >
                {t("social.requests.title")}
                {pendingFollowRequests > 0 && (
                  <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                    {pendingFollowRequests}
                  </span>
                )}
              </Link>
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
  const pendingFollowRequests = loaderData?.pendingFollowRequests ?? 0;
  const unreadNotifications = loaderData?.unreadNotifications ?? 0;
  useEffect(() => {
    if (user) {
      initSentryClient();
      Sentry.setUser({ id: user.id });
    } else {
      Sentry.setUser(null);
      stopSentryClient();
    }
  }, [user]);

  return (
    <LocaleProvider locale={locale}>
      <AlphaBanner />
      <NavBar
        user={user ?? null}
        pendingFollowRequests={pendingFollowRequests}
        unreadNotifications={unreadNotifications}
      />
      <Outlet />
      <Footer />
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
