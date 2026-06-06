// Mapping from journal activities to ActivityStreams objects (spec:
// social-federation, "Outbox publishes user's public activities" +
// push delivery). One mapping, used by both the outbox dispatcher and
// the deliver-activity job so remotes see identical shapes either way.
//
// Shape decision (design.md open question, resolved toward Mastodon
// compat): plain `Create(Note)`. The Note's HTML content carries the
// human-readable text + a link back to the activity page; structured
// trails metadata (distance, elevation, duration) rides along as
// PropertyValue attachments, which Mastodon ignores gracefully and
// trails consumers can read without parsing the HTML.

import { Temporal as TemporalPolyfill } from "@js-temporal/polyfill";
import { Create, Delete, Note, PropertyValue, Tombstone, PUBLIC_COLLECTION } from "@fedify/fedify/vocab";
import { getOrigin } from "./config.server.ts";
import { localActorIri } from "./actor-iri.ts";

export interface FederatableActivity {
  id: string;
  name: string;
  description: string | null;
  distance: number | null;
  elevationGain: number | null;
  duration: number | null;
  startedAt: Date | null;
  createdAt: Date;
}

/** Public IRI of an activity — its journal detail page. */
export function activityObjectIri(activityId: string): string {
  return `${getOrigin()}/activities/${activityId}`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatStats(a: FederatableActivity): string {
  const parts: string[] = [];
  if (a.distance != null) parts.push(`${(a.distance / 1000).toFixed(1)} km`);
  if (a.elevationGain != null) parts.push(`↗ ${Math.round(a.elevationGain)} m`);
  if (a.duration != null) {
    const h = Math.floor(a.duration / 3600);
    const m = Math.round((a.duration % 3600) / 60);
    parts.push(h > 0 ? `${h}h ${m}m` : `${m}m`);
  }
  return parts.join(" · ");
}

// Fedify's types reference the *global* Temporal namespace
// (esnext.temporal lib); Node 22 doesn't ship Temporal at runtime, so
// we construct via the polyfill and bridge the nominally-distinct (but
// structurally identical) types with a cast.
function toInstant(d: Date): Temporal.Instant {
  return TemporalPolyfill.Instant.fromEpochMilliseconds(
    d.getTime(),
  ) as unknown as Temporal.Instant;
}

export function activityToNote(a: FederatableActivity, ownerUsername: string): Note {
  const objectIri = activityObjectIri(a.id);
  const stats = formatStats(a);
  const paragraphs = [
    `<p>${escapeHtml(a.name)}</p>`,
    a.description ? `<p>${escapeHtml(a.description)}</p>` : "",
    stats ? `<p>${escapeHtml(stats)}</p>` : "",
    `<p><a href="${objectIri}">${objectIri}</a></p>`,
  ].filter(Boolean);

  const attachments: PropertyValue[] = [];
  if (a.distance != null) {
    attachments.push(new PropertyValue({ name: "distance-m", value: String(Math.round(a.distance)) }));
  }
  if (a.elevationGain != null) {
    attachments.push(new PropertyValue({ name: "elevation-gain-m", value: String(Math.round(a.elevationGain)) }));
  }
  if (a.duration != null) {
    attachments.push(new PropertyValue({ name: "duration-s", value: String(a.duration) }));
  }

  return new Note({
    id: new URL(objectIri),
    attribution: new URL(localActorIri(ownerUsername)),
    content: paragraphs.join("\n"),
    mediaType: "text/html",
    url: new URL(objectIri),
    published: toInstant(a.startedAt ?? a.createdAt),
    to: PUBLIC_COLLECTION,
    attachments,
  });
}

export function activityToCreate(a: FederatableActivity, ownerUsername: string): Create {
  return new Create({
    // Stable id derived from the object so replays/dedupe work across
    // outbox pages and push deliveries alike.
    id: new URL(`${activityObjectIri(a.id)}#create`),
    actor: new URL(localActorIri(ownerUsername)),
    object: activityToNote(a, ownerUsername),
    published: toInstant(a.startedAt ?? a.createdAt),
    to: PUBLIC_COLLECTION,
  });
}

/**
 * Retraction for a deleted (or un-publicized) activity. Carries a
 * Tombstone so remotes drop their copy (Mastodon honors Delete +
 * Tombstone).
 */
export function activityToDelete(objectIri: string, ownerUsername: string): Delete {
  return new Delete({
    id: new URL(`${objectIri}#delete-${Date.now()}`),
    actor: new URL(localActorIri(ownerUsername)),
    object: new Tombstone({ id: new URL(objectIri) }),
    to: PUBLIC_COLLECTION,
  });
}
