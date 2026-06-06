// Process-level pg-boss singleton. server.ts initializes the boss + starts
// the worker; feature code (e.g., activities.server.ts) calls `getBoss()`
// to enqueue jobs against the same instance. The singleton's lifecycle
// is bound to the Node process — startWorker calls boss.start(); the
// SIGTERM handler stops it.
//
// The instance lives on globalThis, NOT in a module-local variable. In
// production there are TWO copies of this module in the process:
// server.ts imports the TypeScript source directly (node
// --experimental-strip-types), while route handlers live in the
// bundled build/server/index.js with its own module instance. A
// module-local `_boss` set by server.ts is invisible to the bundle, so
// every request-path enqueue (notifications fan-out, federation
// deliveries, komoot imports) silently failed in production with
// "pg-boss not initialized". Symbol.for() gives both copies the same
// global registry key.

import { logger } from "./logger.server.ts";

// Structurally typed (we only need `send`) so we don't have to pull
// pg-boss into the journal app's dep graph just for the typedef.
export interface BossSendOptions {
  retryLimit?: number;
  retryBackoff?: boolean;
  retryDelay?: number;
}

interface BossLike {
  send(queueName: string, data: unknown, options?: BossSendOptions): Promise<string | null>;
}

const BOSS_KEY = Symbol.for("trails-cool.journal.pg-boss");

type BossGlobal = { [BOSS_KEY]?: BossLike | null };

/** Set by server.ts once the boss is created + started. */
export function setBoss(boss: BossLike | null): void {
  (globalThis as BossGlobal)[BOSS_KEY] = boss;
}

/**
 * Get the started pg-boss instance. Throws if called before
 * server.ts has initialized it (i.e., outside a running Journal
 * server context).
 */
export function getBoss(): BossLike {
  const boss = (globalThis as BossGlobal)[BOSS_KEY];
  if (!boss) {
    throw new Error("pg-boss not initialized — getBoss called before server bootstrap");
  }
  return boss;
}

/**
 * Best-effort enqueue: log + swallow errors so a downstream queue
 * outage doesn't fail the user-visible request that triggered the
 * fan-out. Use this for "fire and forget" notifications work.
 */
export async function enqueueOptional(
  queue: string,
  data: unknown,
  ctx: Record<string, unknown> = {},
  options?: BossSendOptions,
): Promise<void> {
  try {
    const boss = getBoss();
    await boss.send(queue, data, options);
  } catch (err) {
    logger.warn({ err, queue, ...ctx }, "boss.send failed; continuing");
  }
}
