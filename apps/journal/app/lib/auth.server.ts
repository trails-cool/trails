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
import { getDb } from "./db.ts";
import { users, credentials, magicTokens } from "@trails-cool/db/schema/journal";
import type { Visibility } from "@trails-cool/db/schema/journal";

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
  termsVersion: string,
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
    termsAcceptedAt: new Date(),
    termsVersion,
  });

  await db.insert(credentials).values({
    id: randomUUID(),
    userId,
    credentialId: Buffer.from(credential.id, "base64url"),
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: response.response.transports,
  });

  return userId;
}

// --- Add Passkey to Existing Account ---

export async function addPasskeyStart(userId: string) {
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error("User not found");

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(userId),
    userName: user.username,
    userDisplayName: user.displayName ?? user.username,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  return options;
}

export async function addPasskeyFinish(
  userId: string,
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
    throw new Error("Passkey verification failed");
  }

  const { credential } = verification.registrationInfo;

  await db.insert(credentials).values({
    id: randomUUID(),
    userId,
    credentialId: Buffer.from(credential.id, "base64url"),
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: response.response.transports,
  });
}

// --- Registration via Magic Link (no passkey) ---

export async function registerWithMagicLink(
  email: string,
  username: string,
  termsVersion: string,
): Promise<{ token: string; code: string }> {
  const db = getDb();

  const [existingEmail] = await db.select().from(users).where(eq(users.email, email));
  if (existingEmail) throw new Error("Email already in use");

  const [existingUsername] = await db.select().from(users).where(eq(users.username, username));
  if (existingUsername) throw new Error("Username already taken");

  const userId = randomUUID();
  const domain = process.env.DOMAIN ?? "localhost";

  await db.insert(users).values({
    id: userId,
    email,
    username,
    domain,
    termsAcceptedAt: new Date(),
    termsVersion,
  });

  // Same shape as login's createMagicToken — token for the click-through
  // link, 6-digit code for paste-from-email/SMS flows (mobile).
  const token = randomBytes(32).toString("base64url");
  const code = generateLoginCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.insert(magicTokens).values({
    id: randomUUID(),
    email,
    token,
    code,
    expiresAt,
  });

  return { token, code };
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

function generateLoginCode(): string {
  // 6-digit numeric code, zero-padded
  const num = randomBytes(3).readUIntBE(0, 3) % 1_000_000;
  return String(num).padStart(6, "0");
}

export async function createMagicToken(email: string): Promise<{ token: string; code: string }> {
  const db = getDb();

  // Check user exists
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) throw new Error("No account found for this email");

  const token = randomBytes(32).toString("base64url");
  const code = generateLoginCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.insert(magicTokens).values({
    id: randomUUID(),
    email,
    token,
    code,
    expiresAt,
  });

  return { token, code };
}

export async function verifyLoginCode(email: string, code: string): Promise<string> {
  const db = getDb();

  const [record] = await db
    .select()
    .from(magicTokens)
    .where(
      and(
        eq(magicTokens.email, email),
        eq(magicTokens.code, code),
        eq(magicTokens.purpose, "login"),
        gt(magicTokens.expiresAt, new Date()),
        isNull(magicTokens.usedAt),
      ),
    );

  if (!record) throw new Error("Invalid or expired code");

  await db
    .update(magicTokens)
    .set({ usedAt: new Date() })
    .where(eq(magicTokens.id, record.id));

  const [user] = await db.select().from(users).where(eq(users.email, record.email));
  if (!user) throw new Error("User not found");

  return user.id;
}

export async function initiateEmailChange(userId: string, newEmail: string): Promise<string> {
  const db = getDb();

  const [existing] = await db.select().from(users).where(eq(users.email, newEmail));
  if (existing) throw new Error("Email already in use");

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error("User not found");
  if (user.email === newEmail) throw new Error("This is already your email");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.insert(magicTokens).values({
    id: randomUUID(),
    email: newEmail,
    purpose: "email-change",
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
        eq(magicTokens.purpose, "login"),
        gt(magicTokens.expiresAt, new Date()),
        isNull(magicTokens.usedAt),
      ),
    );

  if (!record) throw new Error("Invalid or expired magic link");

  await db
    .update(magicTokens)
    .set({ usedAt: new Date() })
    .where(eq(magicTokens.id, record.id));

  const [user] = await db.select().from(users).where(eq(users.email, record.email));
  if (!user) throw new Error("User not found");

  return user.id;
}

export async function verifyEmailChange(token: string, userId: string): Promise<string> {
  const db = getDb();

  const [record] = await db
    .select()
    .from(magicTokens)
    .where(
      and(
        eq(magicTokens.token, token),
        eq(magicTokens.purpose, "email-change"),
        gt(magicTokens.expiresAt, new Date()),
        isNull(magicTokens.usedAt),
      ),
    );

  if (!record) throw new Error("Invalid or expired verification link");

  const newEmail = record.email;

  // Re-check email availability at verification time — someone may have
  // registered with this email between initiation and verification
  const [existing] = await db.select().from(users).where(eq(users.email, newEmail));
  if (existing) {
    await db.update(magicTokens).set({ usedAt: new Date() }).where(eq(magicTokens.id, record.id));
    throw new Error("This email is now in use by another account");
  }

  await db
    .update(magicTokens)
    .set({ usedAt: new Date() })
    .where(eq(magicTokens.id, record.id));

  await db
    .update(users)
    .set({ email: newEmail })
    .where(eq(users.id, userId));

  return newEmail;
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

/**
 * A row that carries the minimum a visibility check needs.
 */
export interface Viewable {
  ownerId: string;
  visibility: Visibility;
}

/**
 * The caller's identity. `null` represents a logged-out visitor.
 */
export interface Viewer {
  id: string;
}

/**
 * Decide whether a viewer may see a piece of content.
 *
 * - `public` content is viewable by anyone.
 * - `unlisted` content is viewable only on direct-link access — listings
 *   should omit it. Callers rendering a detail page pass `asDirectLink:
 *   true`; listings default to `false`.
 * - `private` content is viewable only by the owner.
 *
 * Centralised here so detail loaders and listing queries use the same
 * rule. Intentionally does not throw; callers handle the `false` case
 * (usually by returning HTTP 404 rather than 403 to avoid leaking
 * existence).
 */
export function canView(
  content: Viewable,
  viewer: Viewer | null,
  { asDirectLink = false }: { asDirectLink?: boolean } = {},
): boolean {
  if (content.visibility === "public") return true;
  if (content.visibility === "unlisted" && asDirectLink) return true;
  return viewer?.id === content.ownerId;
}

/**
 * Record the user's acceptance of the current Terms version. Updates both
 * `terms_accepted_at` (NOW) and `terms_version`. Used when an existing user
 * re-accepts after the Terms have been updated.
 */
export async function recordTermsAcceptance(userId: string, termsVersion: string) {
  const db = getDb();
  await db
    .update(users)
    .set({ termsAcceptedAt: new Date(), termsVersion })
    .where(eq(users.id, userId));
}

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
