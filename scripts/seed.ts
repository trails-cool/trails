import { createDb } from "../packages/db/src/index.ts";
import { users, routes, activities } from "../packages/db/src/schema/journal.ts";

const db = createDb();

const SEED_USER_ID = "seed-user-dev";
const SEED_ROUTE_ID = "seed-route-berlin";
const SEED_ACTIVITY_ID = "seed-activity-berlin";

// Minimal GPX for a short Berlin route (Tiergarten area)
const BERLIN_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="trails.cool" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Tiergarten Loop</name>
    <trkseg>
      <trkpt lat="52.5145" lon="13.3501"><ele>34</ele></trkpt>
      <trkpt lat="52.5150" lon="13.3560"><ele>35</ele></trkpt>
      <trkpt lat="52.5170" lon="13.3620"><ele>35</ele></trkpt>
      <trkpt lat="52.5190" lon="13.3580"><ele>36</ele></trkpt>
      <trkpt lat="52.5200" lon="13.3510"><ele>35</ele></trkpt>
      <trkpt lat="52.5145" lon="13.3501"><ele>34</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

await db
  .insert(users)
  .values({
    id: SEED_USER_ID,
    email: "dev@trails.cool",
    username: "devuser",
    displayName: "Dev User",
    domain: "localhost:3000",
    profileVisibility: "public",
  })
  .onConflictDoNothing();

await db
  .insert(routes)
  .values({
    id: SEED_ROUTE_ID,
    ownerId: SEED_USER_ID,
    name: "Tiergarten Loop",
    description: "A short loop through Tiergarten for local dev testing.",
    gpx: BERLIN_GPX,
    routingProfile: "trekking",
    distance: 1200,
    elevationGain: 5,
    elevationLoss: 5,
    visibility: "public",
  })
  .onConflictDoNothing();

await db
  .insert(activities)
  .values({
    id: SEED_ACTIVITY_ID,
    ownerId: SEED_USER_ID,
    routeId: SEED_ROUTE_ID,
    name: "Morning walk in Tiergarten",
    gpx: BERLIN_GPX,
    startedAt: new Date("2024-06-01T08:00:00Z"),
    duration: 1800,
    distance: 1200,
    elevationGain: 5,
    elevationLoss: 5,
    visibility: "public",
  })
  .onConflictDoNothing();

console.log("✓ Seed complete");
process.exit(0);
