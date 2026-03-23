import { randomUUID, randomBytes } from "node:crypto";
import { eq, and, gt, isNull } from "drizzle-orm";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/types";
import { getDb } from "./db";
import { users, credentials, magicTokens } from "@trails-cool/db/schema/journal";

const RP_NAME = "trails.cool";
const RP_ID = process.env.DOMAIN ?? "localhost";
const ORIGIN = process.env.ORIGIN ?? `http://localhost:3000`;

// --- Registration ---

export async function startRegistration(email: string, username: string) {
  const db = getDb();

  // Check for existing email/username
  const [existingEmail] = await db.select().from(users).where(eq(users.email, email));
  if (existingEmail) throw new Error("Email already in use");

  const [existingUsername] = await db.select().from(users).where(eq(users.username, username));
  if (existingUsername) throw new Error("Username already taken");

  const userId = randomUUID();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(userId),
    userName: username,
    userDisplayName: username,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  return { options, userId };
}

export async function finishRegistration(
  userId: string,
  email: string,
  username: string,
  response: RegistrationResponseJSON,
  challenge: string,
) {
  const db = getDb();

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Registration verification failed");
  }

  const { credential } = verification.registrationInfo;
  const domain = process.env.DOMAIN ?? "localhost";

  // Create user and credential in a transaction
  await db.insert(users).values({
    id: userId,
    email,
    username,
    domain,
  });

  await db.insert(credentials).values({
    id: randomUUID(),
    userId,
    credentialId: Buffer.from(credential.id),
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: response.response.transports,
  });

  return userId;
}

// --- Passkey Login ---

export async function startAuthentication() {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "preferred",
  });

  return options;
}

export async function finishAuthentication(
  response: AuthenticationResponseJSON,
  challenge: string,
) {
  const db = getDb();

  const credentialIdBuffer = Buffer.from(response.rawId, "base64url");

  // Find the credential
  const [cred] = await db
    .select()
    .from(credentials)
    .where(eq(credentials.credentialId, credentialIdBuffer));

  if (!cred) throw new Error("Credential not found");

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: Buffer.from(cred.credentialId).toString("base64url"),
      publicKey: new Uint8Array(cred.publicKey),
      counter: cred.counter,
      transports: cred.transports as AuthenticatorTransportFuture[] | undefined,
    },
  });

  if (!verification.verified) {
    throw new Error("Authentication verification failed");
  }

  // Update counter
  await db
    .update(credentials)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(credentials.id, cred.id));

  return cred.userId;
}

// --- Magic Links ---

export async function createMagicToken(email: string): Promise<string> {
  const db = getDb();

  // Check user exists
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) throw new Error("No account found for this email");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.insert(magicTokens).values({
    id: randomUUID(),
    email,
    token,
    expiresAt,
  });

  return token;
}

export async function verifyMagicToken(token: string): Promise<string> {
  const db = getDb();

  const [record] = await db
    .select()
    .from(magicTokens)
    .where(
      and(
        eq(magicTokens.token, token),
        gt(magicTokens.expiresAt, new Date()),
        isNull(magicTokens.usedAt),
      ),
    );

  if (!record) throw new Error("Invalid or expired magic link");

  // Mark as used
  await db
    .update(magicTokens)
    .set({ usedAt: new Date() })
    .where(eq(magicTokens.id, record.id));

  // Find user
  const [user] = await db.select().from(users).where(eq(users.email, record.email));
  if (!user) throw new Error("User not found");

  return user.id;
}

// --- Sessions ---

import { createCookieSessionStorage } from "react-router";

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
