import * as SecureStore from "expo-secure-store";
import { API_VERSION } from "@trails-cool/api";

const STORE_KEY_SERVER_URL = "server_url";
const DEFAULT_SERVER_URL = __DEV__ ? "http://localhost:3000" : "https://trails.cool";

export interface DiscoveryResponse {
  apiVersion: string;
  instanceName: string;
  apiBaseUrl: string;
  tileUrl?: string;
}

/**
 * Get the stored server URL, or the default.
 */
export async function getServerUrl(): Promise<string> {
  const stored = await SecureStore.getItemAsync(STORE_KEY_SERVER_URL);
  return stored ?? DEFAULT_SERVER_URL;
}

/**
 * Store a new server URL.
 */
export async function setServerUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY_SERVER_URL, url);
}

/**
 * Clear the stored server URL (resets to default).
 */
export async function clearServerUrl(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY_SERVER_URL);
}

/**
 * Fetch and validate the discovery endpoint for a server URL.
 * Returns the parsed discovery response or throws.
 */
export async function fetchDiscovery(serverUrl: string): Promise<DiscoveryResponse> {
  const url = `${serverUrl.replace(/\/+$/, "")}/.well-known/trails-cool`;
  console.log("[Discovery] Fetching:", url);

  let resp: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    resp = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (err) {
    console.error("[Discovery] Fetch failed:", err);
    throw new ServerConfigError("network_error", (err as Error).message);
  }
  console.log("[Discovery] Response status:", resp.status);

  if (!resp.ok) {
    throw new ServerConfigError(
      "discovery_failed",
      `Server returned ${resp.status}`,
    );
  }

  const data = await resp.json();
  if (!data.apiVersion || !data.instanceName || !data.apiBaseUrl) {
    throw new ServerConfigError(
      "invalid_discovery",
      "Server returned an invalid discovery response",
    );
  }

  return data as DiscoveryResponse;
}

/**
 * Parse the major version number from a semver string.
 */
function majorVersion(semver: string): number {
  const match = semver.match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

/**
 * Check if the server's API version is compatible with this app.
 * Compares major versions — the server must match the app's major version.
 */
export function isApiVersionCompatible(serverVersion: string): boolean {
  return majorVersion(serverVersion) === majorVersion(API_VERSION);
}

export class ServerConfigError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
