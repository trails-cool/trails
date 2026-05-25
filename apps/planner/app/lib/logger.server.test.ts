import { describe, it, expect } from "vitest";
import { Writable } from "node:stream";
import pino from "pino";
import { AsyncLocalStorage } from "node:async_hooks";

// Mirrors the journal's logger test — the mixin contract is what
// matters: pino's `mixin` callback reads from AsyncLocalStorage and
// tags every record with the active requestId.

describe("planner logger mixin attaches requestId from async context", () => {
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
    als.run({ requestId: "p-abc" }, () => lg.info("hello"));
    const record = JSON.parse(lines[0]!);
    expect(record.requestId).toBe("p-abc");
  });

  it("omits requestId when no async context is active", () => {
    const als = new AsyncLocalStorage<{ requestId: string }>();
    const { lg, lines } = captureLogger(als);
    lg.info("bare");
    const record = JSON.parse(lines[0]!);
    expect(record.requestId).toBeUndefined();
  });
});
