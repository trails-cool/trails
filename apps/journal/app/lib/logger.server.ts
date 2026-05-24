import pino from "pino";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request context propagated through the async stack. The HTTP
 * server wraps each request in `requestContext.run({ requestId }, ...)`
 * so every downstream `logger.info(...)` automatically tags log lines
 * with `requestId` — no need to thread it through every call site.
 */
export interface RequestContext {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // Mixin runs on every log call and merges its return value into the
  // emitted record. Reading from ALS here is what makes requestId
  // automatic for every downstream logger.info/warn/error.
  mixin: () => {
    const ctx = requestContext.getStore();
    return ctx ? { requestId: ctx.requestId } : {};
  },
  ...(process.env.NODE_ENV !== "production"
    ? { transport: { target: "pino-pretty" } }
    : {}),
});
