// Komoot API client. Covers unauthenticated public profile access and
// authenticated tour listing / GPX export.
//
// All network calls use plain fetch; no auth state is cached here.

const API_BASE = "https://api.komoot.de/v007";
const AUTH_BASE = "https://api.komoot.de/v006";

export interface KomootTour {
  id: string;
  name: string;
  sport: string;
  date: string;
  distance: number;
  duration: number;
  elevationUp: number;
  elevationDown: number;
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

// Accepts a plain numeric ID or a Komoot profile URL in any locale variant.
// Returns the numeric user ID string, or null if it cannot be parsed.
export function parseKomootUserId(input: string): string | null {
  const trimmed = input.trim();
  // Plain numeric ID
  if (/^\d+$/.test(trimmed)) return trimmed;
  // URL forms: https://www.komoot.com/user/12345 or .../de-de/user/12345
  const match = trimmed.match(/komoot\.(?:com|de)\/(?:[a-z]{2}-[a-z]{2}\/)?user\/(\d+)/i);
  return match?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// Public profile
// ---------------------------------------------------------------------------

interface KomootPublicProfileResponse {
  username: string;
  display_name?: string;
  content?: {
    text?: string | null;
    link?: string | null;
  };
}

export async function fetchPublicProfile(komootUserId: string): Promise<{
  displayName: string;
  contentText: string | null;
  contentLink: string | null;
}> {
  const resp = await fetch(`${API_BASE}/users/${komootUserId}/`);
  if (!resp.ok) {
    throw new Error(`Komoot profile fetch failed: ${resp.status}`);
  }
  const data = (await resp.json()) as KomootPublicProfileResponse;
  return {
    displayName: data.display_name ?? data.username,
    contentText: data.content?.text ?? null,
    contentLink: data.content?.link ?? null,
  };
}

// Returns true if the profile's content text contains the trails profile URL
// (case-insensitive, trimmed).
export async function verifyKomootOwnership(
  komootUserId: string,
  trailsProfileUrl: string,
): Promise<boolean> {
  try {
    const profile = await fetchPublicProfile(komootUserId);
    if (!profile.contentText) return false;
    return profile.contentText.toLowerCase().includes(trailsProfileUrl.toLowerCase().trim());
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

interface KomootAuthResponse {
  username: string;
  // The API returns user data nested under the email key in v006
  email?: string;
}

// Login with email+password via Basic auth. Returns the Komoot username
// (numeric user ID) and the base64-encoded Basic auth token.
export async function loginKomoot(
  email: string,
  password: string,
): Promise<{ username: string; basicAuthToken: string }> {
  const basicAuthToken = Buffer.from(`${email}:${password}`).toString("base64");
  const resp = await fetch(`${AUTH_BASE}/account/email/${encodeURIComponent(email)}/`, {
    headers: { Authorization: `Basic ${basicAuthToken}` },
  });
  if (!resp.ok) {
    throw new Error(`Komoot login failed: ${resp.status}`);
  }
  const data = (await resp.json()) as KomootAuthResponse;
  return { username: data.username, basicAuthToken };
}

// ---------------------------------------------------------------------------
// Tours
// ---------------------------------------------------------------------------

interface KomootTourRaw {
  id: number;
  name: string;
  type: string;
  date: string;
  distance?: number;
  duration?: number;
  elevation_up?: number;
  elevation_down?: number;
}

interface KomootToursResponse {
  _embedded?: {
    tours?: KomootTourRaw[];
  };
  page?: {
    totalPages?: number;
    number?: number;
  };
}

function toTour(raw: KomootTourRaw): KomootTour {
  return {
    id: String(raw.id),
    name: raw.name || `Tour ${raw.id}`,
    sport: raw.type,
    date: raw.date,
    distance: raw.distance ?? 0,
    duration: raw.duration ?? 0,
    elevationUp: raw.elevation_up ?? 0,
    elevationDown: raw.elevation_down ?? 0,
  };
}

export async function fetchKomootTours(
  komootUserId: string,
  page: number,
  basicAuthToken?: string,
): Promise<{ tours: KomootTour[]; totalPages: number }> {
  const params = new URLSearchParams({
    page: String(page - 1), // Komoot uses 0-based pages
    limit: "50",
  });
  if (!basicAuthToken) {
    params.set("status", "public");
  }
  const headers: Record<string, string> = {};
  if (basicAuthToken) {
    headers["Authorization"] = `Basic ${basicAuthToken}`;
  }
  const resp = await fetch(`${API_BASE}/users/${komootUserId}/tours/?${params}`, { headers });
  if (!resp.ok) {
    throw new Error(`Komoot tours fetch failed: ${resp.status}`);
  }
  const data = (await resp.json()) as KomootToursResponse;
  const tours = (data._embedded?.tours ?? []).map(toTour);
  const totalPages = data.page?.totalPages ?? 1;
  return { tours, totalPages };
}

// ---------------------------------------------------------------------------
// GPX export
// ---------------------------------------------------------------------------

export async function fetchKomootTourGpx(
  tourId: string,
  basicAuthToken?: string,
): Promise<string> {
  const headers: Record<string, string> = {};
  if (basicAuthToken) {
    headers["Authorization"] = `Basic ${basicAuthToken}`;
  }
  const resp = await fetch(`${API_BASE}/tours/${tourId}.gpx`, { headers });
  if (!resp.ok) {
    throw new Error(`Komoot GPX fetch failed: ${resp.status}`);
  }
  return resp.text();
}
