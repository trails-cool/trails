// The single enforcement point for "does this user own this entity".
//
// Mutators in routes.server.ts / activities.server.ts take an `OwnedRef`
// — a branded {id, ownerId} that can only be produced here (or by the
// explicit `vouchOwnership` escape hatch). A handler that forgets the
// ownership check no longer compiles, instead of silently no-op'ing or
// leaking another user's data.

import { data } from "react-router";
import { getRoute } from "./routes.server.ts";
import { getActivity } from "./activities.server.ts";

declare const ownedBrand: unique symbol;

/** An entity verified to belong to the acting user (or an equivalent grant). */
export type Owned<T> = T & { readonly [ownedBrand]: true };

/** The minimal shape mutators need; any Owned entity satisfies it. */
export type OwnedRef = Owned<{ id: string; ownerId: string }>;

export type OwnershipFailure = "not_found" | "not_owner";

type LoadResult<T> = { ok: true; entity: Owned<T> } | { ok: false; reason: OwnershipFailure };

function check<T extends { ownerId: string | null }>(
  entity: T | null,
  userId: string,
): LoadResult<T & { ownerId: string }> {
  if (!entity) return { ok: false, reason: "not_found" };
  // ownerId === null covers remote-ingested content, which nobody owns locally.
  if (entity.ownerId === null || entity.ownerId !== userId) {
    return { ok: false, reason: "not_owner" };
  }
  return { ok: true, entity: entity as Owned<T & { ownerId: string }> };
}

/** Non-throwing core — for callers with their own error vocabulary
 *  (discriminated results, apiError JSON shapes). */
export async function loadOwnedRoute(routeId: string, userId: string) {
  return check(await getRoute(routeId), userId);
}

export async function loadOwnedActivity(activityId: string, userId: string) {
  return check(await getActivity(activityId), userId);
}

interface RequireOptions {
  /**
   * Status for the not-owner case. Defaults to 404 so a guessed id
   * doesn't leak that the entity exists; pass 403 on surfaces where
   * the entity is already known to the viewer (e.g. the edit page).
   */
  notOwnerStatus?: 403 | 404;
}

function throwFor(reason: OwnershipFailure, label: string, opts?: RequireOptions): never {
  if (reason === "not_owner" && (opts?.notOwnerStatus ?? 404) === 403) {
    throw data({ error: "Not authorized" }, { status: 403 });
  }
  throw data({ error: `${label} not found` }, { status: 404 });
}

/** Throwing wrapper for web loaders/actions: 404 / 403 as `data()`. */
export async function requireOwnedRoute(routeId: string, userId: string, opts?: RequireOptions) {
  const result = await loadOwnedRoute(routeId, userId);
  if (!result.ok) throwFor(result.reason, "Route", opts);
  return result.entity;
}

export async function requireOwnedActivity(
  activityId: string,
  userId: string,
  opts?: RequireOptions,
) {
  const result = await loadOwnedActivity(activityId, userId);
  if (!result.ok) throwFor(result.reason, "Activity", opts);
  return result.entity;
}

/**
 * Escape hatch for callers whose authorization does not come from a
 * session — today only the Planner JWT callback, where a single-use
 * token scoped to the route stands in for the owner. Every use should
 * be greppable and justified by a comment at the call site.
 */
export function vouchOwnership<T extends { id: string; ownerId: string }>(entity: T): Owned<T> {
  return entity as Owned<T>;
}
