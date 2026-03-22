import { randomUUID } from "node:crypto";
import * as Y from "yjs";
import { eq, and, desc, lt } from "drizzle-orm";
import { getOrCreateDoc, deleteDoc } from "./yjs-server";
import { getDb } from "./db";
import { sessions } from "@trails-cool/db/schema/planner";

export type SessionMetadata = typeof sessions.$inferSelect;

export async function createSession(options?: {
  callbackUrl?: string;
  callbackToken?: string;
}): Promise<SessionMetadata> {
  const id = randomUUID();
  const doc = getOrCreateDoc(id);

  const [row] = await getDb()
    .insert(sessions)
    .values({
      id,
      yjsState: Buffer.from(Y.encodeStateAsUpdate(doc)),
      callbackUrl: options?.callbackUrl,
      callbackToken: options?.callbackToken,
    })
    .returning();

  return row!;
}

export async function getSession(id: string): Promise<SessionMetadata | undefined> {
  const [row] = await getDb()
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.closed, false)));

  return row;
}

export async function touchSession(id: string): Promise<void> {
  await getDb()
    .update(sessions)
    .set({ lastActivity: new Date() })
    .where(eq(sessions.id, id));
}

export async function saveSessionState(id: string): Promise<void> {
  const doc = getOrCreateDoc(id);
  const state = Y.encodeStateAsUpdate(doc);
  await getDb()
    .update(sessions)
    .set({ yjsState: Buffer.from(state), lastActivity: new Date() })
    .where(eq(sessions.id, id));
}

export async function loadSessionState(id: string): Promise<Uint8Array | null> {
  const [row] = await getDb()
    .select({ yjsState: sessions.yjsState })
    .from(sessions)
    .where(eq(sessions.id, id));

  return row?.yjsState ? new Uint8Array(row.yjsState) : null;
}

export async function closeSession(id: string): Promise<boolean> {
  const result = await getDb()
    .update(sessions)
    .set({ closed: true })
    .where(and(eq(sessions.id, id), eq(sessions.closed, false)))
    .returning({ id: sessions.id });

  deleteDoc(id);
  return result.length > 0;
}

export function initializeSessionWithWaypoints(
  sessionId: string,
  waypoints: Array<{ lat: number; lon: number; name?: string }>,
): void {
  const doc = getOrCreateDoc(sessionId);
  const yWaypoints = doc.getArray("waypoints");

  doc.transact(() => {
    for (const wp of waypoints) {
      const yMap = new Y.Map();
      yMap.set("lat", wp.lat);
      yMap.set("lon", wp.lon);
      if (wp.name) yMap.set("name", wp.name);
      yWaypoints.push([yMap]);
    }
  });
}

export async function listSessions(): Promise<SessionMetadata[]> {
  return getDb()
    .select()
    .from(sessions)
    .where(eq(sessions.closed, false))
    .orderBy(desc(sessions.lastActivity));
}

export async function expireSessions(maxAgeDays: number = 7): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  const result = await getDb()
    .delete(sessions)
    .where(lt(sessions.lastActivity, cutoff))
    .returning({ id: sessions.id });

  for (const row of result) {
    deleteDoc(row.id);
  }
  return result.length;
}
