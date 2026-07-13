// Instance blocklist (spec: federation-operations "Instance blocklist").
// A blocked domain is inert in both directions: its inbound activities are
// silently dropped, we send it no deliveries, and we don't fetch its
// actors/outboxes. Matching is exact-host (subdomain wildcarding is
// deferred until a real need). Management is a documented operator SQL
// procedure — see FEDERATION.md — with this table as the seam a future
// admin UI can sit on.

import { inArray, eq } from "drizzle-orm";
import { federationBlockedInstances } from "@trails-cool/db/schema/journal";
import { getDb } from "./db.ts";

/** The host of an actor/object IRI, or null if it doesn't parse. */
export function hostOfIri(iri: string): string | null {
  try {
    return new URL(iri).host;
  } catch {
    return null;
  }
}

/** Whether an exact host is on the blocklist. */
export async function isBlockedDomain(domain: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ domain: federationBlockedInstances.domain })
    .from(federationBlockedInstances)
    .where(eq(federationBlockedInstances.domain, domain))
    .limit(1);
  return row !== undefined;
}

/** Whether an actor/object IRI's host is blocked. Unparseable IRIs are
 * treated as blocked — we won't process something we can't attribute. */
export async function isBlockedIri(iri: string): Promise<boolean> {
  const host = hostOfIri(iri);
  if (host === null) return true;
  return isBlockedDomain(host);
}

/**
 * The subset of `domains` that are blocked, resolved in one query. Used
 * by delivery fan-out to filter a batch of recipients without a query per
 * recipient.
 */
export async function filterBlockedDomains(domains: string[]): Promise<Set<string>> {
  if (domains.length === 0) return new Set();
  const db = getDb();
  const rows = await db
    .select({ domain: federationBlockedInstances.domain })
    .from(federationBlockedInstances)
    .where(inArray(federationBlockedInstances.domain, domains));
  return new Set(rows.map((r) => r.domain));
}
