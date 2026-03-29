import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse } from "react-router";
import type { LinksFunction } from "react-router";
import type { Route } from "./+types/root";
import * as Sentry from "@sentry/react";
import { useTranslation } from "react-i18next";
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
      <body className="h-screen w-screen overflow-hidden bg-white">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (!(isRouteErrorResponse(error) && error.status < 500)) {
    Sentry.captureException(error);
  }
  const { t } = useTranslation();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">{error.status}</h1>
          <p className="mt-2 text-gray-600">
            {error.status === 404 && t("pageNotFound")}
            {error.status === 503 && t("serviceUnavailable")}
            {error.status !== 404 && error.status !== 503 && (error.statusText || t("error"))}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">{t("error")}</h1>
        <p className="mt-2 text-gray-600">
          {error instanceof Error ? error.message : t("error")}
        </p>
      </div>
    </div>
  );
}
