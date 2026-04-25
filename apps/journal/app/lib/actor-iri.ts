// Canonical ActivityPub actor IRI for a local user. Used as the key in
// `follows.followed_actor_iri` so the column shape is identical for local
// and (future) federated follows. Reading from `process.env.ORIGIN` keeps
// us aligned with the rest of the auth/federation stack.
export function localActorIri(username: string): string {
  const origin = process.env.ORIGIN ?? "http://localhost:3000";
  return `${origin}/users/${username}`;
}
