// Postgres-backed Fedify MessageQueue, implemented over the pg-boss
// instance the journal already runs (packages/jobs). Fedify uses this
// queue for outbound delivery (with its own retry scheduling) and inbox
// processing; the previous InProcessMessageQueue lost every queued
// message on restart (spec: federation-operations "Durable federation
// queue"). pg-boss gives us durable storage + delayed jobs; Fedify stays
// the retry-policy owner (see `nativeRetrial` below).
//
// This mirrors the PostgresKvStore adapter pattern (federation-kv.server.ts):
// a thin Fedify-interface shim over infrastructure we already operate,
// resolved lazily via getBoss() so it works in both the server-bootstrap
// module and the request-path bundle (see boss.server.ts on the two-copy
// module situation).
//
// Fedify fans a single MessageQueue instance out to three logical roles
// (inbox / outbox / fanout) and calls listen() once per role with an
// equivalent type-dispatching handler. Backing all three with one pg-boss
// queue is correct: any worker can process any message because Fedify
// routes by message type internally.

import type {
  MessageQueue,
  MessageQueueEnqueueOptions,
  MessageQueueListenOptions,
  MessageQueueDepth,
} from "@fedify/fedify";
import { getBoss } from "./boss.server.ts";

/** pg-boss queue name backing Fedify's inbox/outbox/fanout message queue. */
export const FEDERATION_QUEUE_NAME = "federation.fedify";

export class PgBossMessageQueue implements MessageQueue {
  // Fedify owns retry scheduling: on a failed delivery it re-enqueues with
  // its own backoff policy, so pg-boss must NOT also retry (retryLimit 0
  // on enqueue) or every failure would be attempted twice.
  readonly nativeRetrial = false;

  async enqueue(message: unknown, options?: MessageQueueEnqueueOptions): Promise<void> {
    // Fedify passes delay as a Temporal.Duration; pg-boss startAfter is
    // whole seconds. Round up so a sub-second backoff still defers.
    const seconds = options?.delay ? Math.ceil(options.delay.total("seconds")) : 0;
    await getBoss().send(FEDERATION_QUEUE_NAME, message as object, {
      retryLimit: 0,
      ...(seconds > 0 ? { startAfter: seconds } : {}),
    });
  }

  async listen(
    handler: (message: unknown) => Promise<void> | void,
    options?: MessageQueueListenOptions,
  ): Promise<void> {
    const boss = getBoss();
    await boss.work(FEDERATION_QUEUE_NAME, async (jobs) => {
      for (const job of jobs) await handler(job.data);
    });
    // Fedify's contract: listen() resolves when the signal aborts and never
    // rejects; with no signal it never resolves (runs for the process
    // lifetime, consuming the queue).
    return new Promise<void>((resolve) => {
      const signal = options?.signal;
      if (signal == null) return;
      const stop = () => void boss.offWork(FEDERATION_QUEUE_NAME).finally(() => resolve());
      if (signal.aborted) stop();
      else signal.addEventListener("abort", stop, { once: true });
    });
  }

  async getDepth(): Promise<MessageQueueDepth> {
    const queue = await getBoss().getQueue(FEDERATION_QUEUE_NAME);
    if (queue == null) return { queued: 0, ready: 0, delayed: 0 };
    return {
      queued: queue.queuedCount,
      ready: queue.readyCount,
      delayed: queue.deferredCount,
    };
  }
}
