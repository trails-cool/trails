import * as Sentry from "@sentry/react-native";

const SENTRY_DSN = "https://af50ac7aea803216adbe21e9dd4b896b@o4509530546634752.ingest.de.sentry.io/4511209742532688";

export function initSentry() {
  const enabled = !__DEV__;
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: __DEV__ ? 0 : 1.0,
    enabled,
    sendDefaultPii: false,
    // Session Replay is not installed; document the intent explicitly.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });

  if (!enabled) {
    console.debug("[sentry] mobile init inert in dev; would send to Sentry in production");
  }
}

export { Sentry };
