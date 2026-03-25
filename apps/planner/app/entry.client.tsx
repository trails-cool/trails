import * as Sentry from "@sentry/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

Sentry.init({
  dsn: "https://5215134cd78d5e6c199e29300b8425af@o4509530546634752.ingest.de.sentry.io/4511102546608208",
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  environment: import.meta.env.PROD ? "production" : "development",
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  enabled: import.meta.env.PROD,
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
