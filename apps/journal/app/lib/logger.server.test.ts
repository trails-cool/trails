import { describe, it, expect } from "vitest";
import { Writable } from "node:stream";
import pino from "pino";
import { AsyncLocalStorage } from "node:async_hooks";

// We test the *mixin contract* — that pino's `mixin` callback reads
// from the async-local store and tags every record. Constructing a
// fresh pino instance per test (vs. importing the module-level one)
// lets us capture stdout cleanly.

describe("logger mixin attaches requestId from async context", () => {
  function captureLogger(als: AsyncLocalStorage<{ requestId: string }>) {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _enc, cb) {
        lines.push(chunk.toString());
        cb();
      },
    });
    const lg = pino(
      {
        level: "info",
        mixin: () => {
          const ctx = als.getStore();
          return ctx ? { requestId: ctx.requestId } : {};
        },
      },
      sink,
    );
    return { lg, lines };
  }

  it("tags log records with requestId when inside als.run()", () => {
    const als = new AsyncLocalStorage<{ requestId: string }>();
    const { lg, lines } = captureLogger(als);
    als.run({ requestId: "abc-123" }, () => lg.info("hello"));
    const record = JSON.parse(lines[0]!);
    expect(record.requestId).toBe("abc-123");
    expect(record.msg).toBe("hello");
  });

  it("omits requestId when no async context is active", () => {
    const als = new AsyncLocalStorage<{ requestId: string }>();
    const { lg, lines } = captureLogger(als);
    lg.info("bare");
    const record = JSON.parse(lines[0]!);
    expect(record.requestId).toBeUndefined();
  });
});
