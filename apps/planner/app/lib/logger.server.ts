import pino from "pino";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request context propagated through the async stack. The HTTP
 * server wraps each request in `requestContext.run({ requestId }, ...)`
 * so every downstream `logger.info(...)` automatically tags log lines
 * with `requestId` — see apps/journal/app/lib/logger.server.ts for the
 * same pattern in the journal app.
 */
export interface RequestContext {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  mixin: () => {
    const ctx = requestContext.getStore();
    return ctx ? { requestId: ctx.requestId } : {};
  },
  ...(process.env.NODE_ENV !== "production"
    ? { transport: { target: "pino-pretty" } }
    : {}),
});
