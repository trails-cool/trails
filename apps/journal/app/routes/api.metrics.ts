import { registry, federationQueueDepth } from "~/lib/metrics.server";

export async function loader() {
  // Sample the durable Fedify queue depth at scrape time (the
  // restart-loss regression detector). Best-effort: if federation is off
  // or the boss isn't up yet, leave the last value rather than fail the
  // scrape.
  if (process.env.FEDERATION_ENABLED === "true") {
    try {
      const { PgBossMessageQueue } = await import("~/lib/federation-queue.server");
      const depth = await new PgBossMessageQueue().getDepth();
      federationQueueDepth.set(depth.queued);
    } catch {
      // boss not initialized / transient DB error — keep the prior gauge value
    }
  }
  const metrics = await registry.metrics();
  return new Response(metrics, {
    headers: { "Content-Type": registry.contentType },
  });
}
