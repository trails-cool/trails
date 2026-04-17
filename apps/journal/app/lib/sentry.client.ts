import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from "react-router";

let initialized = false;

export function initSentryClient() {
  if (initialized) return;
  initialized = true;

  const sentryEnvironment = import.meta.env.VITE_SENTRY_ENVIRONMENT ??
    (import.meta.env.PROD ? "production" : "development");
  const enabled = import.meta.env.PROD && sentryEnvironment !== "ci";

  Sentry.init({
    dsn: "https://a32ffcc575d34be072e91b20f247eeee@o4509530546634752.ingest.de.sentry.io/4509530555547728",
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
    enabled,
    sendDefaultPii: false,
    // Session Replay is not installed; document the intent explicitly.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });

  if (!enabled && !import.meta.env.PROD) {
    console.debug(`[sentry] journal client init inert (env=${sentryEnvironment}); would send to Sentry in production`);
  }
}
