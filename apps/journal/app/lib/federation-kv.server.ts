// Postgres-backed Fedify KvStore. Fedify uses its KvStore for inbox
// replay protection (activity-id idempotence), remote document caching,
// and key caching — all state that must survive process restarts and be
// shared across instances of the journal server, which rules out
// MemoryKvStore outside the dev loop (spec: social-federation 4.7).
//
// Keys are KvKey (readonly string[]) serialized as their JSON encoding;
// prefix listing relies on JSON arrays sharing a stable textual prefix
// up to the closing bracket.

import type { KvKey, KvStore, KvStoreListEntry, KvStoreSetOptions } from "@fedify/fedify";
import { eq, sql, like, and, or, isNull, gt, lt } from "drizzle-orm";
import { federationKv } from "@trails-cool/db/schema/journal";
import { getDb } from "./db.ts";

function serializeKey(key: KvKey): string {
  return JSON.stringify(key);
}

/** Predicate: row is not expired (expires_at NULL or in the future). */
function notExpired() {
  return or(isNull(federationKv.expiresAt), gt(federationKv.expiresAt, new Date()));
}

export class PostgresKvStore implements KvStore {
  async get<T = unknown>(key: KvKey): Promise<T | undefined> {
    const db = getDb();
    const [row] = await db
      .select({ value: federationKv.value })
      .from(federationKv)
      .where(and(eq(federationKv.key, serializeKey(key)), notExpired()))
      .limit(1);
    return row === undefined ? undefined : (row.value as T);
  }

  async set(key: KvKey, value: unknown, options?: KvStoreSetOptions): Promise<void> {
    const db = getDb();
    const expiresAt = options?.ttl
      ? new Date(Date.now() + options.ttl.total("milliseconds"))
      : null;
    await db
      .insert(federationKv)
      .values({ key: serializeKey(key), value, expiresAt })
      .onConflictDoUpdate({
        target: federationKv.key,
        set: { value, expiresAt },
      });
  }

  async delete(key: KvKey): Promise<void> {
    const db = getDb();
    await db.delete(federationKv).where(eq(federationKv.key, serializeKey(key)));
  }

  async *list(prefix?: KvKey): AsyncIterable<KvStoreListEntry> {
    const db = getDb();
    const wherePrefix = prefix
      ? // '["a","b"]' minus the trailing ']' is a textual prefix of every
        // key extending ["a","b"] — and of nothing else, since the next
        // character is either ']' (exact) or ',' (extension).
        like(federationKv.key, `${serializeKey(prefix).slice(0, -1)}%`)
      : undefined;
    const rows = await db
      .select({ key: federationKv.key, value: federationKv.value })
      .from(federationKv)
      .where(wherePrefix ? and(wherePrefix, notExpired()) : notExpired());
    for (const row of rows) {
      yield { key: JSON.parse(row.key) as KvKey, value: row.value };
    }
  }

  /** Remove expired rows. Called by the federation-kv-sweep job. */
  async sweepExpired(): Promise<number> {
    const db = getDb();
    const deleted = await db
      .delete(federationKv)
      .where(and(sql`${federationKv.expiresAt} IS NOT NULL`, lt(federationKv.expiresAt, new Date())))
      .returning({ key: federationKv.key });
    return deleted.length;
  }
}
