import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from "react-router";
import { browserSentryConfig } from "@trails-cool/sentry-config";

let initialized = false;

// Build-time DSN injection: `VITE_SENTRY_DSN` (if set during `pnpm build`)
// overrides the flagship default so self-hosters can ship their own
// Sentry project. Set it to `""` (empty string) to disable Sentry on
// the client entirely.
const FLAGSHIP_JOURNAL_DSN =
  "https://a32ffcc575d34be072e91b20f247eeee@o4509530546634752.ingest.de.sentry.io/4509530555547728";
const CLIENT_DSN =
  (import.meta.env as Record<string, string | undefined>).VITE_SENTRY_DSN ??
  FLAGSHIP_JOURNAL_DSN;

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
