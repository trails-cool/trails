const BROUTER_URL = process.env.BROUTER_URL ?? "http://localhost:17777";

export interface RouteRequest {
  waypoints: Array<{ lat: number; lon: number }>;
  profile?: string;
  alternativeIdx?: number;
  format?: string;
}

export async function computeRoute(request: RouteRequest): Promise<unknown> {
  if (request.waypoints.length < 2) {
    throw new Error("At least 2 waypoints are required");
  }

  const lonlats = request.waypoints.map((wp) => `${wp.lon},${wp.lat}`).join("|");

  const params = new URLSearchParams({
    lonlats,
    profile: request.profile ?? "trekking",
    alternativeidx: String(request.alternativeIdx ?? 0),
    format: request.format ?? "geojson",
  });

  const url = `${BROUTER_URL}/brouter?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`BRouter error (${response.status}): ${body}`);
  }

  return response.json();
}

export function getBRouterUrl(): string {
  return BROUTER_URL;
}
