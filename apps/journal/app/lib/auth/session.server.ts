// Cookie session storage. Lives here (separate from auth.server.ts) so
// the post-verify chokepoint (./completion.ts) can compose it without
// dragging the entire auth surface in.
//
// The legacy import path `~/lib/auth.server` continues to re-export
// these symbols for backwards compat — see auth.server.ts.

import { createCookieSessionStorage } from "react-router";
import { eq } from "drizzle-orm";
import { users } from "@trails-cool/db/schema/journal";
import { getDb } from "../db.ts";

const sessionSecret = process.env.SESSION_SECRET ?? "dev-secret-change-in-production";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    secrets: [sessionSecret],
  },
});

export async function createSession(userId: string, request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  session.set("userId", userId);
  return sessionStorage.commitSession(session);
}

export async function getSessionUser(request: Request) {
  const db = getDb();
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");
  if (!userId) return null;

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user ?? null;
}

export async function destroySession(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  return sessionStorage.destroySession(session);
}
