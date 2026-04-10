import type { Route } from "./+types/api.routes.$id.gpx";
import { getRouteWithVersions } from "~/lib/routes.server";
import { parseGpxAsync, computeDays, generateGpx } from "@trails-cool/gpx";

export async function loader({ params, request }: Route.LoaderArgs) {
  const route = await getRouteWithVersions(params.id);
  if (!route?.gpx) {
    return new Response("No GPX data", { status: 404 });
  }

  const url = new URL(request.url);
  const dayParam = url.searchParams.get("day");

  if (!dayParam) {
    return new Response(route.gpx, {
      headers: {
        "Content-Type": "application/gpx+xml",
        "Content-Disposition": `attachment; filename="${route.name.replace(/[^a-z0-9]/gi, "_")}.gpx"`,
      },
    });
  }

  // Export a single day's segment
  const dayNumber = parseInt(dayParam, 10);
  if (isNaN(dayNumber) || dayNumber < 1) {
    return new Response("Invalid day number", { status: 400 });
  }

  try {
    const gpxData = await parseGpxAsync(route.gpx);
    const days = computeDays(gpxData.waypoints, gpxData.tracks);
    const day = days.find((d) => d.dayNumber === dayNumber);
    if (!day) {
      return new Response("Day not found", { status: 404 });
    }

    // Extract track points for this day by matching waypoint positions to track
    const allPoints = gpxData.tracks.flat();
    const startWp = gpxData.waypoints[day.startWaypointIndex]!;
    const endWp = gpxData.waypoints[day.endWaypointIndex]!;

    const findClosest = (wp: { lat: number; lon: number }) => {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < allPoints.length; i++) {
        const dx = allPoints[i]!.lat - wp.lat;
        const dy = allPoints[i]!.lon - wp.lon;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      return bestIdx;
    };

    const startIdx = findClosest(startWp);
    const endIdx = findClosest(endWp);
    const dayPoints = allPoints.slice(startIdx, endIdx + 1);

    const dayName = day.startName && day.endName
      ? `Day ${dayNumber}: ${day.startName} - ${day.endName}`
      : `Day ${dayNumber}`;

    const dayGpx = generateGpx({
      name: dayName,
      tracks: [dayPoints],
    });

    const filename = `${route.name.replace(/[^a-z0-9]/gi, "_")}_day${dayNumber}.gpx`;
    return new Response(dayGpx, {
      headers: {
        "Content-Type": "application/gpx+xml",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return new Response("Failed to extract day segment", { status: 500 });
  }
}
