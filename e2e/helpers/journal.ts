// Shared journal-side constants and seed helpers. The /api/e2e/*
// endpoints only exist when the journal runs with E2E=true.

import type { APIRequestContext } from "@playwright/test";
import { expect } from "../fixtures/test";

export const JOURNAL = "http://localhost:3000";
export const PLANNER = "http://localhost:3001";

/** Mint a route + single-use callback JWT via /api/e2e/seed. */
export async function seedRoute(
  request: APIRequestContext,
): Promise<{ routeId: string; token: string }> {
  const resp = await request.post(`${JOURNAL}/api/e2e/seed`);
  expect(resp.ok(), "POST /api/e2e/seed failed — is the journal running with E2E=true?").toBeTruthy();
  return (await resp.json()) as { routeId: string; token: string };
}

/** Whether the route has PostGIS geometry stored (via /api/e2e/route/:id). */
export async function routeHasGeom(
  request: APIRequestContext,
  routeId: string,
): Promise<boolean> {
  const resp = await request.get(`${JOURNAL}/api/e2e/route/${routeId}`);
  expect(resp.ok()).toBeTruthy();
  const { hasGeom } = (await resp.json()) as { hasGeom: boolean };
  return hasGeom;
}

/** Seeds a Komoot connection for the e2e test user; returns the session cookie. */
export async function seedKomootConnection(
  request: APIRequestContext,
  mode: "public" | "authenticated" = "public",
): Promise<{ cookie: string }> {
  const resp = await request.post(`${JOURNAL}/api/e2e/komoot`, { data: { mode } });
  if (!resp.ok()) throw new Error(`komoot seed failed: ${resp.status()}`);
  const cookie = resp.headers()["set-cookie"];
  return { cookie };
}
