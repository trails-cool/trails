// Module-level pg-boss singleton. server.ts initializes the boss + starts
// the worker; feature code (e.g., activities.server.ts) calls `getBoss()`
// to enqueue jobs against the same instance. The singleton's lifecycle
// is bound to the Node process — startWorker calls boss.start(); the
// SIGTERM handler stops it.

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

let _boss: BossLike | null = null;

/** Set by server.ts once the boss is created + started. */
export function setBoss(boss: BossLike): void {
  _boss = boss;
}

/**
 * Get the started pg-boss instance. Throws if called before
 * server.ts has initialized it (i.e., outside a running Journal
 * server context).
 */
export function getBoss(): BossLike {
  if (!_boss) {
    throw new Error("pg-boss not initialized — getBoss called before server bootstrap");
  }
  return _boss;
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
