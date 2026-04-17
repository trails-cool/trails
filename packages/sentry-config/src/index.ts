/**
 * Shared Sentry configuration helpers for all trails.cool apps.
 *
 * Each app still calls its own SDK-specific `Sentry.init(...)` (they use
 * three different SDKs: `@sentry/node`, `@sentry/react`, `@sentry/react-native`),
 * but the common options are centralised here so privacy defaults (`sendDefaultPii: false`,
 * replay off) and enable logic stay consistent.
 */

/**
 * Drop 404 errors — they come from scanners/typos and aren't bugs.
 * Pass as `beforeSend` to `Sentry.init(...)` on server-side init sites.
 *
 * Typed loosely on purpose: the `@sentry/node` and `@sentry/react` SDKs
 * each have their own `ErrorEvent` / `Event` types, and we don't want this
 * package to depend on either SDK.
 */
export function drop404s<E extends { extra?: Record<string, unknown> }>(event: E): E | null {
  const serialized = event.extra?.__serialized__ as Record<string, unknown> | undefined;
  if (serialized?.status === 404) return null;
  return event;
}

/**
 * Shared Sentry options for Node-side runtimes (the HTTP servers).
 * Spread into `Sentry.init({...nodeSentryConfig("journal server"), dsn, beforeSend: drop404s, integrations})`.
 *
 * Logs a debug message at init time when the config is inert (local dev)
 * so developers can see that Sentry would send in production.
 */
export function nodeSentryConfig(appContext: string) {
  const environment = process.env.CI ? "ci" : (process.env.NODE_ENV ?? "development");
  const enabled = process.env.NODE_ENV === "production" && !process.env.CI;

  if (!enabled && !process.env.CI) {
    console.debug(
      `[sentry] ${appContext} init inert (env=${environment}); would send to Sentry in production`,
    );
  }

  return {
    environment,
    enabled,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 1.0,
    sendDefaultPii: false as const,
  };
}

interface BrowserEnv {
  PROD: boolean;
  VITE_SENTRY_ENVIRONMENT?: string;
}

/**
 * Shared Sentry options for Vite/browser runtimes.
 * Spread into `Sentry.init({...browserSentryConfig("journal client", import.meta.env), dsn, integrations})`.
 *
 * Replay sample rates are explicitly 0 — replay integration is not installed,
 * but the options document the intent and prevent accidental enablement.
 */
export function browserSentryConfig(appContext: string, env: BrowserEnv) {
  const environment = env.VITE_SENTRY_ENVIRONMENT ?? (env.PROD ? "production" : "development");
  const enabled = env.PROD && environment !== "ci";

  if (!enabled && !env.PROD) {
    console.debug(
      `[sentry] ${appContext} init inert (env=${environment}); would send to Sentry in production`,
    );
  }

  return {
    environment,
    enabled,
    tracesSampleRate: environment === "ci" ? 0 : 1.0,
    sendDefaultPii: false as const,
    replaysSessionSampleRate: 0 as const,
    replaysOnErrorSampleRate: 0 as const,
  };
}

/**
 * Shared Sentry options for React Native.
 * Spread into `Sentry.init({...mobileSentryConfig(__DEV__), dsn})`.
 */
export function mobileSentryConfig(dev: boolean) {
  const enabled = !dev;

  if (dev) {
    console.debug("[sentry] mobile init inert in dev; would send to Sentry in production");
  }

  return {
    enabled,
    tracesSampleRate: dev ? 0 : 1.0,
    sendDefaultPii: false as const,
    replaysSessionSampleRate: 0 as const,
    replaysOnErrorSampleRate: 0 as const,
  };
}
