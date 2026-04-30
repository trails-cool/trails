export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  providerUserId?: string;
}

export interface Workout {
  id: string;
  name: string;
  type: string;
  startedAt: string;
  duration: number | null; // seconds
  distance: number | null; // meters
  fileUrl?: string;
}

export interface WorkoutList {
  workouts: Workout[];
  total: number;
  page: number;
  perPage: number;
}

export interface WebhookEvent {
  eventType: string;
  providerUserId: string;
  workoutId: string;
  fileUrl?: string;
}

export interface PushRoutePayload {
  /** Pre-encoded FIT Course bytes — the action route runs gpxToFitCourse before calling pushRoute. */
  fit: Uint8Array;
  /** Stable per (route, version) — `route:<routeId>:v<version>` for trails.cool. */
  externalId: string;
  providerUpdatedAt: Date;
  name: string;
  description?: string;
  /** Decimal degrees. */
  startLat: number;
  startLng: number;
  /** Meters. */
  distance: number;
  /** Total elevation gain in meters. */
  ascent: number;
  filename?: string;
}

export interface PushRouteResult {
  remoteId: string;
}

export type PushErrorCode =
  | "scope_missing"
  | "token_expired"
  | "validation"
  | "rate_limit"
  | "generic";

export class PushError extends Error {
  code: PushErrorCode;
  status?: number;

  constructor(code: PushErrorCode, message: string, status?: number) {
    super(message);
    this.name = "PushError";
    this.code = code;
    this.status = status;
  }
}

export interface SyncProvider {
  id: string;
  name: string;
  scopes: string[];

  getAuthUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;

  listWorkouts(tokens: TokenSet, page: number): Promise<WorkoutList>;
  downloadFile(tokens: TokenSet, workout: Workout): Promise<Buffer>;
  convertToGpx(fileBuffer: Buffer): Promise<string | null>;

  parseWebhook(body: unknown): WebhookEvent | null;

  /** Optional: providers that can accept routes implement this. UI hides the action when undefined. */
  pushRoute?: (tokens: TokenSet, payload: PushRoutePayload) => Promise<PushRouteResult>;
}

export function providerSupportsPush(
  provider: SyncProvider,
): provider is SyncProvider & { pushRoute: NonNullable<SyncProvider["pushRoute"]> } {
  return typeof provider.pushRoute === "function";
}
