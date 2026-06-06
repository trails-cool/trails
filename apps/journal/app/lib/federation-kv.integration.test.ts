import { describe, it, expect, afterAll } from "vitest";
import { like } from "drizzle-orm";
import { getDb } from "./db.ts";
import { federationKv } from "@trails-cool/db/schema/journal";
import { PostgresKvStore } from "./federation-kv.server.ts";

// Opt-in: talks to real Postgres (same convention as the other
// *.integration.test.ts files).
const runIntegration = process.env.FEDERATION_INTEGRATION === "1";

// Namespace keys per test run so concurrent runs can't collide.
const NS = `test-${Date.now()}`;

describe.runIf(runIntegration)("PostgresKvStore (integration)", () => {
  const store = new PostgresKvStore();

  afterAll(async () => {
    const db = getDb();
    await db.delete(federationKv).where(like(federationKv.key, `["${NS}"%`));
  });

  it("roundtrips JSON values", async () => {
    await store.set([NS, "a"], { hello: "world", n: 42 });
    expect(await store.get([NS, "a"])).toEqual({ hello: "world", n: 42 });
  });

  it("returns undefined for missing keys", async () => {
    expect(await store.get([NS, "missing"])).toBeUndefined();
  });

  it("overwrites on set (upsert)", async () => {
    await store.set([NS, "b"], 1);
    await store.set([NS, "b"], 2);
    expect(await store.get([NS, "b"])).toBe(2);
  });

  it("expired values read as missing and are swept", async () => {
    // Duck-typed Temporal.Duration — the store only calls
    // .total("milliseconds"), and pulling in the polyfill just for the
    // test isn't worth a dependency.
    const oneMs = { total: () => 1 } as unknown as Temporal.Duration;
    await store.set([NS, "ttl"], "ephemeral", { ttl: oneMs });
    await new Promise((r) => setTimeout(r, 10));
    expect(await store.get([NS, "ttl"])).toBeUndefined();
    const purged = await store.sweepExpired();
    expect(purged).toBeGreaterThanOrEqual(1);
  });

  it("deletes keys", async () => {
    await store.set([NS, "c"], "x");
    await store.delete([NS, "c"]);
    expect(await store.get([NS, "c"])).toBeUndefined();
  });

  it("lists by prefix without matching sibling prefixes", async () => {
    await store.set([NS, "list", "one"], 1);
    await store.set([NS, "list", "two"], 2);
    await store.set([NS, "listish"], 3); // shares textual prefix, different key path

    const entries = [];
    for await (const e of store.list([NS, "list"])) entries.push(e);
    const keys = entries.map((e) => e.key.join("/")).sort();
    expect(keys).toEqual([`${NS}/list/one`, `${NS}/list/two`]);
  });
});
