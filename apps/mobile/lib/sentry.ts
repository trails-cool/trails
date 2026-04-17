import * as Sentry from "@sentry/react-native";
import { mobileSentryConfig } from "@trails-cool/sentry-config";

const SENTRY_DSN = "https://af50ac7aea803216adbe21e9dd4b896b@o4509530546634752.ingest.de.sentry.io/4511209742532688";

export function initSentry() {
  Sentry.init({
    dsn: SENTRY_DSN,
    ...mobileSentryConfig(__DEV__),
  });
}

export { Sentry };
