import { describe, it, expect } from "vitest";

// Importing every job module pulls in their (transitively heavy)
// server deps; mock the leaf modules with side effects so this stays a
// unit test of the registry wiring.
import { vi } from "vitest";
vi.mock("../lib/db.ts", () => ({ getDb: vi.fn() }));
vi.mock("../lib/logger.server.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("job registry", () => {
  it("every job's queue name is unique and a key of JobPayloads", async () => {
    const modules = await Promise.all([
      import("./backfill-user-keypairs.ts"),
      import("./consumed-jti-sweep.ts"),
      import("./deliver-activity.ts"),
      import("./demo-bot-generate.ts"),
      import("./demo-bot-prune.ts"),
      import("./federation-kv-sweep.ts"),
      import("./garmin-import-activity.ts"),
      import("./import-batches-sweep.ts"),
      import("./komoot-bulk-import.ts"),
      import("./notifications-fanout.ts"),
      import("./notifications-purge.ts"),
      import("./poll-remote-actor.ts"),
      import("./poll-remote-outboxes.ts"),
      import("./send-welcome-email.ts"),
    ]);

    const names = modules.flatMap((m) =>
      Object.values(m as Record<string, unknown>)
        .filter(
          (v): v is { name: string; handler: unknown } =>
            typeof v === "object" && v !== null && "handler" in v && "name" in v,
        )
        .map((def) => def.name),
    );

    expect(names).toHaveLength(14);
    expect(new Set(names).size).toBe(names.length);
    // pg-boss v11+ queue-name constraint, mirrored from packages/jobs
    for (const name of names) {
      expect(name).toMatch(/^[A-Za-z0-9_.-]+$/);
    }
  });
});
