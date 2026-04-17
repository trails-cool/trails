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
