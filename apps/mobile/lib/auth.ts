import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import { getServerUrl } from "./server-config";

const STORE_KEY_ACCESS_TOKEN = "access_token";
const STORE_KEY_REFRESH_TOKEN = "refresh_token";
const CLIENT_ID = "trails-cool-mobile";
const REDIRECT_URI = "trailscool://auth/callback";

// --- PKCE helpers ---

function generateCodeVerifier(): string {
  const bytes = Crypto.getRandomBytes(32);
  return uint8ToBase64Url(bytes);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  // Convert standard base64 to base64url
  return hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function uint8ToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// --- Token storage ---

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORE_KEY_ACCESS_TOKEN);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORE_KEY_REFRESH_TOKEN);
}

async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY_ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(STORE_KEY_REFRESH_TOKEN, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY_ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(STORE_KEY_REFRESH_TOKEN);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}

// --- Login flow ---

export async function login(): Promise<boolean> {
  const serverUrl = await getServerUrl();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const authorizeUrl = new URL(`${serverUrl}/oauth/authorize`);
  authorizeUrl.searchParams.set("client_id", CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const result = await WebBrowser.openAuthSessionAsync(
    authorizeUrl.toString(),
    REDIRECT_URI,
  );

  if (result.type !== "success") return false;

  const callbackUrl = new URL(result.url);
  const code = callbackUrl.searchParams.get("code");
  if (!code) return false;

  // Exchange code for tokens
  const tokenUrl = `${serverUrl}/oauth/token`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!resp.ok) return false;

  const tokens = await resp.json();
  await storeTokens(tokens.access_token, tokens.refresh_token);
  return true;
}

// --- Token refresh ---

export async function refreshTokens(): Promise<boolean> {
  const serverUrl = await getServerUrl();
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });

  const resp = await fetch(`${serverUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!resp.ok) {
    await clearTokens();
    return false;
  }

  const tokens = await resp.json();
  await storeTokens(tokens.access_token, tokens.refresh_token);
  return true;
}

// --- Logout ---

export async function logout(): Promise<void> {
  await clearTokens();
}
