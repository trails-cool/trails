import "./fitsdk-shim.ts";
import { Encoder, Profile } from "@garmin/fitsdk";
import { parseGpxAsync } from "@trails-cool/gpx";
import type { TrackPoint } from "@trails-cool/gpx";

import { degToSemicircles } from "./semicircles.ts";

export type FitCourseSport = "cycling" | "running" | "hiking";

export interface GpxToFitCourseInput {
  gpx: string;
  name: string;
  description?: string;
  sport?: FitCourseSport;
}

const SPORT_ENUM: Record<FitCourseSport, string> = {
  cycling: "cycling",
  running: "running",
  hiking: "hiking",
};

export async function gpxToFitCourse(input: GpxToFitCourseInput): Promise<Uint8Array> {
  const data = await parseGpxAsync(input.gpx);
  const points: TrackPoint[] = data.tracks.flat();

  if (points.length === 0) {
    throw new Error("Cannot encode FIT Course from a GPX with zero track points");
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const startTime = new Date("2020-01-01T00:00:00Z");

  const encoder = new Encoder();

  encoder.writeMesg({
    mesgNum: Profile.MesgNum.FILE_ID,
    type: "course",
    manufacturer: "development",
    product: 0,
    timeCreated: startTime,
    serialNumber: 0,
  });

  encoder.writeMesg({
    mesgNum: Profile.MesgNum.FILE_CREATOR,
    softwareVersion: 1,
    hardwareVersion: 0,
  });

  encoder.writeMesg({
    mesgNum: Profile.MesgNum.COURSE,
    name: input.name,
    sport: SPORT_ENUM[input.sport ?? "cycling"],
    capabilities: 0x00000004,
  });

  encoder.writeMesg({
    mesgNum: Profile.MesgNum.LAP,
    timestamp: startTime,
    startTime,
    startPositionLat: degToSemicircles(first.lat),
    startPositionLong: degToSemicircles(first.lon),
    endPositionLat: degToSemicircles(last.lat),
    endPositionLong: degToSemicircles(last.lon),
    totalElapsedTime: 0,
    totalTimerTime: 0,
    totalDistance: data.distance,
  });

  encoder.writeMesg({
    mesgNum: Profile.MesgNum.EVENT,
    timestamp: startTime,
    event: "timer",
    eventType: "start",
  });

  let cumulativeDistance = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (i > 0) {
      const prev = points[i - 1]!;
      cumulativeDistance += haversine(prev.lat, prev.lon, p.lat, p.lon);
    }
    const mesg: { mesgNum: number; [field: string]: unknown } = {
      mesgNum: Profile.MesgNum.RECORD,
      timestamp: new Date(startTime.getTime() + i * 1000),
      positionLat: degToSemicircles(p.lat),
      positionLong: degToSemicircles(p.lon),
      distance: cumulativeDistance,
    };
    if (p.ele !== undefined) {
      mesg.altitude = p.ele;
    }
    encoder.writeMesg(mesg);
  }

  encoder.writeMesg({
    mesgNum: Profile.MesgNum.EVENT,
    timestamp: new Date(startTime.getTime() + (points.length - 1) * 1000),
    event: "timer",
    eventType: "stopAll",
  });

  return encoder.close();
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
