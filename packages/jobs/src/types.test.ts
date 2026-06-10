import { describe, it, expect } from "vitest";
import type { Job } from "pg-boss";
import { defineJob } from "./types.ts";

describe("defineJob", () => {
  it("returns the definition unchanged (the cast is type-level only)", async () => {
    const seen: string[] = [];
    const def = defineJob<{ widgetId: string }>({
      name: "widget-job",
      retryLimit: 2,
      async handler(jobs) {
        for (const job of jobs) {
          // job.data is typed { widgetId: string } — no cast needed
          seen.push(job.data.widgetId);
        }
        return null;
      },
    });

    expect(def.name).toBe("widget-job");
    expect(def.retryLimit).toBe(2);

    // The returned JobDefinition's handler is the same function and
    // receives whatever pg-boss hands it.
    await def.handler([{ data: { widgetId: "w1" } } as Job<unknown>]);
    expect(seen).toEqual(["w1"]);
  });
});
