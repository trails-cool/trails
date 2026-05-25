import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from "react-router";
import { browserSentryConfig } from "@trails-cool/sentry-config";

let initialized = false;

// Build-time DSN injection. `VITE_SENTRY_DSN` (set during `pnpm build`,
// see apps/journal/Dockerfile + cd-apps.yml) determines whether the
// client emits Sentry events at all. Self-hosted builds without the
// env var produce a Sentry-free client bundle.
const CLIENT_DSN = (import.meta.env as Record<string, string | undefined>)
  .VITE_SENTRY_DSN;

export function initSentryClient() {
  if (initialized) return;
  initialized = true;
  if (!CLIENT_DSN) return;

  Sentry.init({
    dsn: CLIENT_DSN,
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
