import { randomUUID } from "node:crypto";
import * as Y from "yjs";
import { getOrCreateDoc, deleteDoc } from "./yjs-server";
import { sql } from "./db";

export interface SessionMetadata {
  id: string;
  createdAt: Date;
  lastActivity: Date;
  callbackUrl?: string;
  callbackToken?: string;
  closed: boolean;
}

export async function createSession(options?: {
  callbackUrl?: string;
  callbackToken?: string;
}): Promise<SessionMetadata> {
  const id = randomUUID();
  const doc = getOrCreateDoc(id);

  const [row] = await sql`
    INSERT INTO planner.sessions (id, yjs_state, callback_url, callback_token)
    VALUES (${id}, ${Buffer.from(Y.encodeStateAsUpdate(doc))}, ${options?.callbackUrl ?? null}, ${options?.callbackToken ?? null})
    RETURNING id, created_at, last_activity, callback_url, callback_token, closed
  `;

  return mapRow(row);
}

export async function getSession(id: string): Promise<SessionMetadata | undefined> {
  const [row] = await sql`
    SELECT id, created_at, last_activity, callback_url, callback_token, closed
    FROM planner.sessions
    WHERE id = ${id} AND closed = FALSE
  `;
  return row ? mapRow(row) : undefined;
}

export async function touchSession(id: string): Promise<void> {
  await sql`
    UPDATE planner.sessions SET last_activity = NOW() WHERE id = ${id}
  `;
}

export async function saveSessionState(id: string): Promise<void> {
  const doc = getOrCreateDoc(id);
  const state = Y.encodeStateAsUpdate(doc);
  await sql`
    UPDATE planner.sessions
    SET yjs_state = ${Buffer.from(state)}, last_activity = NOW()
    WHERE id = ${id}
  `;
}

export async function loadSessionState(id: string): Promise<Uint8Array | null> {
  const [row] = await sql`
    SELECT yjs_state FROM planner.sessions WHERE id = ${id}
  `;
  return row?.yjs_state ? new Uint8Array(row.yjs_state) : null;
}

export async function closeSession(id: string): Promise<boolean> {
  const result = await sql`
    UPDATE planner.sessions SET closed = TRUE WHERE id = ${id} AND closed = FALSE
    RETURNING id
  `;
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
  const rows = await sql`
    SELECT id, created_at, last_activity, callback_url, callback_token, closed
    FROM planner.sessions
    WHERE closed = FALSE
    ORDER BY last_activity DESC
  `;
  return rows.map(mapRow);
}

export async function expireSessions(maxAgeDays: number = 7): Promise<number> {
  const result = await sql`
    DELETE FROM planner.sessions
    WHERE last_activity < NOW() - INTERVAL '1 day' * ${maxAgeDays}
    RETURNING id
  `;
  for (const row of result) {
    deleteDoc(row.id);
  }
  return result.length;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): SessionMetadata {
  return {
    id: row.id as string,
    createdAt: row.created_at as Date,
    lastActivity: row.last_activity as Date,
    callbackUrl: (row.callback_url as string) ?? undefined,
    callbackToken: (row.callback_token as string) ?? undefined,
    closed: row.closed as boolean,
  };
}
