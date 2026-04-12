import { getServerUrl } from "./server-config";
import { getAccessToken, refreshTokens, clearTokens } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export class NetworkError extends Error {
  constructor(message = "Network request failed") {
    super(message);
  }
}

/**
 * Base API client with bearer token injection and automatic 401 refresh.
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const serverUrl = await getServerUrl();
  const baseUrl = `${serverUrl}/api/v1`;
  const url = `${baseUrl}${path}`;

  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let resp: Response;
  try {
    resp = await fetch(url, { ...options, headers });
  } catch (err) {
    throw new NetworkError((err as Error).message);
  }

  // Auto-refresh on 401
  if (resp.status === 401 && token) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      const newToken = await getAccessToken();
      headers["Authorization"] = `Bearer ${newToken}`;
      try {
        resp = await fetch(url, { ...options, headers });
      } catch (err) {
        throw new NetworkError((err as Error).message);
      }
    } else {
      await clearTokens();
      throw new ApiError(401, "UNAUTHORIZED", "Session expired. Please log in again.");
    }
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new ApiError(
      resp.status,
      body.code ?? "UNKNOWN",
      body.error ?? `Request failed with status ${resp.status}`,
    );
  }

  return resp.json();
}

// --- Routes ---

export function listRoutes(cursor?: string, limit = 20) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return request<unknown>(`/routes?${params}`);
}

export function getRoute(id: string) {
  return request<unknown>(`/routes/${id}`);
}

export function createRoute(data: { name: string; description?: string; gpx?: string }) {
  return request<unknown>("/routes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateRoute(id: string, data: { name?: string; description?: string; gpx?: string }) {
  return request<unknown>(`/routes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// --- Activities ---

export function listActivities(cursor?: string, limit = 20) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return request<unknown>(`/activities?${params}`);
}

export function getActivity(id: string) {
  return request<unknown>(`/activities/${id}`);
}

export function createActivity(data: {
  name: string;
  description?: string;
  gpx?: string;
  routeId?: string;
  startedAt?: string;
  duration?: number;
  distance?: number;
}) {
  return request<unknown>("/activities", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
