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
}
