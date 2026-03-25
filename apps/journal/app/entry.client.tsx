import * as Sentry from "@sentry/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

const sentryEnvironment = import.meta.env.VITE_SENTRY_ENVIRONMENT ??
  (import.meta.env.PROD ? "production" : "development");

Sentry.init({
  dsn: "https://a32ffcc575d34be072e91b20f247eeee@o4509530546634752.ingest.de.sentry.io/4509530555547728",
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  environment: sentryEnvironment,
  tracesSampleRate: sentryEnvironment === "ci" ? 0 : 1.0,
  replaysSessionSampleRate: sentryEnvironment === "ci" ? 0 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  enabled: import.meta.env.PROD && sentryEnvironment !== "ci",
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
