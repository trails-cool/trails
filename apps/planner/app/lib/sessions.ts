import { randomUUID } from "node:crypto";
import * as Y from "yjs";
import { getOrCreateDoc, deleteDoc } from "./yjs-server";

export interface SessionMetadata {
  id: string;
  createdAt: Date;
  lastActivity: Date;
  callbackUrl?: string;
  callbackToken?: string;
}

const sessions = new Map<string, SessionMetadata>();

export function createSession(options?: {
  callbackUrl?: string;
  callbackToken?: string;
}): SessionMetadata {
  const id = randomUUID();
  const now = new Date();
  const session: SessionMetadata = {
    id,
    createdAt: now,
    lastActivity: now,
    callbackUrl: options?.callbackUrl,
    callbackToken: options?.callbackToken,
  };

  sessions.set(id, session);
  getOrCreateDoc(id); // Initialize Yjs doc

  return session;
}

export function getSession(id: string): SessionMetadata | undefined {
  return sessions.get(id);
}

export function touchSession(id: string): void {
  const session = sessions.get(id);
  if (session) {
    session.lastActivity = new Date();
  }
}

export function closeSession(id: string): boolean {
  const existed = sessions.delete(id);
  deleteDoc(id);
  return existed;
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

export function listSessions(): SessionMetadata[] {
  return Array.from(sessions.values());
}
