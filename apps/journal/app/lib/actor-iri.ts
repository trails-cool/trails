import { getOrigin } from "./config.server.ts";

// Canonical ActivityPub actor IRI for a local user. Used as the key in
// `follows.followed_actor_iri` so the column shape is identical for local
// and (future) federated follows.
export function localActorIri(username: string): string {
  return `${getOrigin()}/users/${username}`;
}
