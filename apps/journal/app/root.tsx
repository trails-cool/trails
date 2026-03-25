import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse } from "react-router";
import type { LinksFunction } from "react-router";
import type { Route } from "./+types/root";
import * as Sentry from "@sentry/react";
import { useTranslation } from "react-i18next";
import { initI18n } from "@trails-cool/i18n";
import stylesheet from "@trails-cool/ui/styles.css?url";

initI18n();

export const links: LinksFunction = () => [{ rel: "stylesheet", href: stylesheet }];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  Sentry.captureException(error);
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
