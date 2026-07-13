import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setBoss } from "./boss.server.ts";
import { PgBossMessageQueue, FEDERATION_QUEUE_NAME } from "./federation-queue.server.ts";

// A durable in-memory stand-in for pg-boss: `sent` survives across adapter
// instances (like rows in Postgres), which is what lets us model a restart
// — a fresh PgBossMessageQueue.listen() draining messages a previous
// instance enqueued. Only the methods the adapter uses are implemented.
interface SentJob {
  data: unknown;
  startAfter?: number;
  retryLimit?: number;
  consumed: boolean;
}

class FakeBoss {
  sent: SentJob[] = [];
  offWorkCalls: string[] = [];

  async send(name: string, data: unknown, options?: { startAfter?: number; retryLimit?: number }) {
    expect(name).toBe(FEDERATION_QUEUE_NAME);
    this.sent.push({ data, startAfter: options?.startAfter, retryLimit: options?.retryLimit, consumed: false });
    return "job-id";
  }

  // Drain every ready (non-delayed, unconsumed) job through the handler,
  // mirroring a worker that picks up the durable backlog on startup.
  async work(name: string, handler: (jobs: Array<{ id: string; name: string; data: unknown }>) => Promise<unknown>) {
    expect(name).toBe(FEDERATION_QUEUE_NAME);
    for (const job of this.sent) {
      if (job.consumed || (job.startAfter ?? 0) > 0) continue;
      job.consumed = true;
      await handler([{ id: "j", name, data: job.data }]);
    }
    return "worker-id";
  }

  async offWork(name: string) {
    this.offWorkCalls.push(name);
  }

  async createQueue() {}

  async getQueue(name: string) {
    expect(name).toBe(FEDERATION_QUEUE_NAME);
    const pending = this.sent.filter((j) => !j.consumed);
    const delayed = pending.filter((j) => (j.startAfter ?? 0) > 0).length;
    return { queuedCount: pending.length, readyCount: pending.length - delayed, deferredCount: delayed };
  }
}

let boss: FakeBoss;

beforeEach(() => {
  boss = new FakeBoss();
  setBoss(boss as unknown as Parameters<typeof setBoss>[0]);
});

afterEach(() => {
  setBoss(null);
});

describe("PgBossMessageQueue", () => {
  it("enqueues with no retry (Fedify owns retries) and no delay by default", async () => {
    const q = new PgBossMessageQueue();
    await q.enqueue({ hello: "world" });
    expect(boss.sent).toHaveLength(1);
    const [job] = boss.sent;
    expect(job).toMatchObject({ data: { hello: "world" }, retryLimit: 0 });
    expect(job?.startAfter).toBeUndefined();
  });

  it("maps a Temporal delay to whole-second startAfter (rounded up)", async () => {
    const q = new PgBossMessageQueue();
    const delay = { total: () => 1.2 } as unknown as Temporal.Duration;
    await q.enqueue({ x: 1 }, { delay });
    expect(boss.sent[0]?.startAfter).toBe(2);
  });

  it("declares nativeRetrial=false so Fedify keeps ownership of retries", () => {
    expect(new PgBossMessageQueue().nativeRetrial).toBe(false);
  });

  it("consume roundtrip: a listener receives the enqueued message payload", async () => {
    const q = new PgBossMessageQueue();
    await q.enqueue({ type: "Create", id: "a" });
    const received: unknown[] = [];
    const ac = new AbortController();
    // listen() resolves only on abort; register the worker (which drains
    // the backlog), then stop.
    const listening = q.listen((m) => void received.push(m), { signal: ac.signal });
    ac.abort();
    await listening;
    expect(received).toEqual([{ type: "Create", id: "a" }]);
  });

  it("survives a restart: a fresh listener drains messages a prior instance enqueued", async () => {
    // Prior process: enqueue two, never consumed (crash before delivery).
    const before = new PgBossMessageQueue();
    await before.enqueue({ n: 1 });
    await before.enqueue({ n: 2 });

    // New process: same durable store, brand-new adapter instance.
    const after = new PgBossMessageQueue();
    const received: unknown[] = [];
    const ac = new AbortController();
    const listening = after.listen((m) => void received.push(m), { signal: ac.signal });
    ac.abort();
    await listening;

    expect(received).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("listen resolves on abort and stops the worker", async () => {
    const q = new PgBossMessageQueue();
    const ac = new AbortController();
    const listening = q.listen(() => {}, { signal: ac.signal });
    ac.abort();
    await expect(listening).resolves.toBeUndefined();
    expect(boss.offWorkCalls).toContain(FEDERATION_QUEUE_NAME);
  });

  it("reports queue depth split into ready and delayed", async () => {
    const q = new PgBossMessageQueue();
    await q.enqueue({ n: 1 });
    await q.enqueue({ n: 2 }, { delay: { total: () => 30 } as unknown as Temporal.Duration });
    expect(await q.getDepth()).toEqual({ queued: 2, ready: 1, delayed: 1 });
  });
});
