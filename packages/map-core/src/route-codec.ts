// Compact, lossless-at-working-precision codecs for the planner's computed
// route as stored in the Yjs session doc (spec: planner-route-encoding).
// Framework-free so it can be unit-tested and run on both the client and
// the server. All encoded values carry a short version prefix so the read
// path can tell them apart from the legacy JSON encoding (which is a bare
// `[` … `]`), enabling transparent backward compatibility.

// 1e6 ≈ 0.11 m: matches the 6-decimal precision BRouter/GPX emit, so a
// round-trip preserves the router's own coordinates (GPX export is
// unchanged in practice). Values stay well within 32-bit for real
// lon/lat ranges (±180e6 → ~29 bits after zig-zag).
const PRECISION = 1_000_000;
const ELEV_PRECISION = 10; // decimetre — finer than any real elevation source
const POLYLINE_PREFIX = "p1:";
const RUNS_PREFIX = "r1:";
const ELEV_PREFIX = "e1:";

// --- base64 via the global btoa/atob (present in browsers and Node 18+),
// so this stays framework-free with no @types/node dependency ---
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- unsigned/zig-zag varint over a byte array ---
function writeVarint(out: number[], value: number): void {
  let v = value >>> 0;
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v = v >>> 7;
  }
  out.push(v);
}
function readVarints(bytes: Uint8Array): number[] {
  const nums: number[] = [];
  let v = 0;
  let shift = 0;
  for (const byte of bytes) {
    v |= (byte & 0x7f) << shift;
    if (byte & 0x80) {
      shift += 7;
    } else {
      nums.push(v >>> 0);
      v = 0;
      shift = 0;
    }
  }
  return nums;
}
const zigzag = (n: number): number => (n << 1) ^ (n >> 31);
const unzigzag = (n: number): number => (n >>> 1) ^ -(n & 1);

/** True if `s` is a compact-encoded value (vs a legacy JSON string). */
export function isEncodedPolyline(s: string): boolean {
  return s.startsWith(POLYLINE_PREFIX);
}
export function isEncodedRuns(s: string): boolean {
  return s.startsWith(RUNS_PREFIX);
}
export function isEncodedElevations(s: string): boolean {
  return s.startsWith(ELEV_PREFIX);
}

/**
 * Encode a per-coordinate elevation channel (metres) as delta + zig-zag
 * varint over decimetre-precision integers. Elevation is the third
 * coordinate dimension; the horizontal [lon,lat] pairs go through
 * {@link encodePolyline}, so the two together carry the full [lon,lat,ele].
 */
export function encodeElevations(eles: readonly number[]): string {
  const bytes: number[] = [];
  let prev = 0;
  for (const e of eles) {
    const iv = Math.round(e * ELEV_PRECISION);
    writeVarint(bytes, zigzag(iv - prev));
    prev = iv;
  }
  return ELEV_PREFIX + bytesToBase64(Uint8Array.from(bytes));
}

export function decodeElevations(s: string): number[] {
  if (!isEncodedElevations(s)) throw new Error("not encoded elevations");
  const nums = readVarints(base64ToBytes(s.slice(ELEV_PREFIX.length)));
  const out: number[] = [];
  let e = 0;
  for (const n of nums) {
    e += unzigzag(n);
    out.push(e / ELEV_PRECISION);
  }
  return out;
}

/**
 * Encode `[lon, lat]` coordinates as delta + zig-zag varint over
 * fixed-precision integers, base64'd. Lossless to ~1 m.
 */
export function encodePolyline(coords: ReadonlyArray<readonly [number, number]>): string {
  const ints: number[] = [];
  let prevLon = 0;
  let prevLat = 0;
  for (const [lon, lat] of coords) {
    const iLon = Math.round(lon * PRECISION);
    const iLat = Math.round(lat * PRECISION);
    ints.push(zigzag(iLon - prevLon), zigzag(iLat - prevLat));
    prevLon = iLon;
    prevLat = iLat;
  }
  const bytes: number[] = [];
  for (const n of ints) writeVarint(bytes, n);
  return POLYLINE_PREFIX + bytesToBase64(Uint8Array.from(bytes));
}

export function decodePolyline(s: string): [number, number][] {
  if (!isEncodedPolyline(s)) throw new Error("not an encoded polyline");
  const nums = readVarints(base64ToBytes(s.slice(POLYLINE_PREFIX.length)));
  const coords: [number, number][] = [];
  let lon = 0;
  let lat = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    lon += unzigzag(nums[i]!);
    lat += unzigzag(nums[i + 1]!);
    coords.push([lon / PRECISION, lat / PRECISION]);
  }
  return coords;
}

/**
 * Run-length-encode a per-coordinate metadata channel. Road attributes run
 * in long identical stretches, so this collapses thousands of entries to a
 * handful of `[value, count]` pairs.
 */
export function encodeRuns(values: readonly string[]): string {
  const runs: [string, number][] = [];
  for (const v of values) {
    const last = runs[runs.length - 1];
    if (last && last[0] === v) last[1]++;
    else runs.push([v, 1]);
  }
  return RUNS_PREFIX + JSON.stringify(runs);
}

export function decodeRuns(s: string): string[] {
  if (!isEncodedRuns(s)) throw new Error("not encoded runs");
  const runs = JSON.parse(s.slice(RUNS_PREFIX.length)) as [string, number][];
  const out: string[] = [];
  for (const [value, count] of runs) {
    for (let i = 0; i < count; i++) out.push(value);
  }
  return out;
}
