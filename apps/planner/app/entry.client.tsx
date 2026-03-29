import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from "react-router";
import { initI18nClient } from "@trails-cool/i18n";

const sentryEnvironment = import.meta.env.VITE_SENTRY_ENVIRONMENT ??
  (import.meta.env.PROD ? "production" : "development");

Sentry.init({
  dsn: "https://5215134cd78d5e6c199e29300b8425af@o4509530546634752.ingest.de.sentry.io/4511102546608208",
  integrations: [
    Sentry.reactRouterV7BrowserTracingIntegration({
      useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
  ],
  environment: sentryEnvironment,
  tracesSampleRate: sentryEnvironment === "ci" ? 0 : 1.0,
  enabled: import.meta.env.PROD && sentryEnvironment !== "ci",
});

initI18nClient();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
