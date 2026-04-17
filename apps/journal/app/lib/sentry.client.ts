import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from "react-router";
import { browserSentryConfig } from "@trails-cool/sentry-config";

let initialized = false;

export function initSentryClient() {
  if (initialized) return;
  initialized = true;

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
    ...browserSentryConfig("journal client", import.meta.env),
  });
}

/**
 * Tear down the Sentry client on logout. After this call, `Sentry.captureException`
 * and other hub methods become no-ops until `initSentryClient` is called again.
 *
 * Fire-and-forget: the close flush happens async, but we don't want to block the
 * logout UI on it.
 */
export function stopSentryClient() {
  if (!initialized) return;
  initialized = false;
  void Sentry.close();
}
