const API_BASE = "https://api.komoot.de/v007";
const AUTH_BASE = "https://api.komoot.de/v006";

export interface KomootCredentials {
  email: string;
  password: string;
  username: string;
  token: string;
}

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

export interface KomootTourPage {
  tours: KomootTour[];
  totalPages: number;
  page: number;
}

export async function login(
  email: string,
  password: string,
): Promise<{ username: string; token: string }> {
  const res = await fetch(`${AUTH_BASE}/account/email/${email}/`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}:${password}`).toString("base64")}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("Invalid Komoot credentials");
    }
    throw new Error(`Komoot login failed: ${res.status}`);
  }

  const data = (await res.json()) as { username: string };
  return { username: data.username, token: Buffer.from(`${email}:${password}`).toString("base64") };
}

export async function fetchTours(
  creds: KomootCredentials,
  page = 0,
): Promise<KomootTourPage> {
  const res = await fetch(
    `${API_BASE}/users/${creds.username}/tours/?page=${page}&limit=50&type=tour_recorded&sort_field=date&sort_direction=desc`,
    {
      headers: { Authorization: `Basic ${creds.token}` },
    },
  );

  if (!res.ok) {
    if (res.status === 401) throw new Error("Komoot auth expired");
    throw new Error(`Komoot tours fetch failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    _embedded?: {
      tours?: Array<{
        id: number;
        name: string;
        sport: string;
        date: string;
        distance: number;
        duration: number;
        elevation_up: number;
        elevation_down: number;
      }>;
    };
    page?: { totalPages: number; number: number };
  };

  console.log("[komoot] page response keys:", Object.keys(data), "page field:", JSON.stringify(data.page));

  const tours = (data._embedded?.tours ?? []).map((t) => ({
    id: String(t.id),
    name: t.name,
    sport: t.sport,
    date: t.date,
    distance: t.distance,
    duration: t.duration,
    elevationUp: t.elevation_up,
    elevationDown: t.elevation_down,
  }));

  return {
    tours,
    totalPages: data.page?.totalPages ?? 1,
    page: data.page?.number ?? 0,
  };
}

export async function fetchTourGpx(
  creds: KomootCredentials,
  tourId: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/tours/${tourId}.gpx`, {
    headers: { Authorization: `Basic ${creds.token}` },
  });

  if (!res.ok) {
    throw new Error(`Komoot GPX fetch failed for tour ${tourId}: ${res.status}`);
  }

  return res.text();
}

export function parseTourResponse(data: unknown): KomootTour[] {
  const obj = data as {
    _embedded?: {
      tours?: Array<{
        id: number;
        name: string;
        sport: string;
        date: string;
        distance: number;
        duration: number;
        elevation_up: number;
        elevation_down: number;
      }>;
    };
  };
  return (obj._embedded?.tours ?? []).map((t) => ({
    id: String(t.id),
    name: t.name,
    sport: t.sport,
    date: t.date,
    distance: t.distance,
    duration: t.duration,
    elevationUp: t.elevation_up,
    elevationDown: t.elevation_down,
  }));
}
