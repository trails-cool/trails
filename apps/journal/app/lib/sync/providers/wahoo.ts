import FitParser from "fit-file-parser";
import { generateGpx } from "@trails-cool/gpx";
import type { SyncProvider, TokenSet, Workout, WorkoutList, WebhookEvent } from "../types.ts";

const WAHOO_API = "https://api.wahooligan.com";
const WAHOO_AUTH = "https://api.wahooligan.com/oauth";

const clientId = () => process.env.WAHOO_CLIENT_ID ?? "";
const clientSecret = () => process.env.WAHOO_CLIENT_SECRET ?? "";

export const wahooProvider: SyncProvider = {
  id: "wahoo",
  name: "Wahoo",
  scopes: ["workouts_read", "user_read", "offline_data"],

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: clientId(),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: this.scopes.join(" "),
      state,
    });
    return `${WAHOO_AUTH}/authorize?${params}`;
  },

  async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
    const resp = await fetch(`${WAHOO_AUTH}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId(),
        client_secret: clientSecret(),
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    if (!resp.ok) throw new Error(`Wahoo token exchange failed: ${resp.status}`);
    const data = await resp.json() as { access_token: string; refresh_token: string; expires_in: number };

    // Fetch user info to get provider user ID
    const userResp = await fetch(`${WAHOO_API}/v1/user`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const user = userResp.ok ? (await userResp.json() as { id: number }) : null;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      providerUserId: user?.id?.toString(),
    };
  },

  async refreshToken(refreshToken: string): Promise<TokenSet> {
    const resp = await fetch(`${WAHOO_AUTH}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId(),
        client_secret: clientSecret(),
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!resp.ok) throw new Error(`Wahoo token refresh failed: ${resp.status}`);
    const data = await resp.json() as { access_token: string; refresh_token: string; expires_in: number };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  },

  async listWorkouts(tokens: TokenSet, page: number): Promise<WorkoutList> {
    const params = new URLSearchParams({ page: String(page), per_page: "30" });
    const resp = await fetch(`${WAHOO_API}/v1/workouts?${params}`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!resp.ok) throw new Error(`Wahoo list workouts failed: ${resp.status}`);
    const data = await resp.json() as {
      workouts: Array<{
        id: number;
        name: string;
        workout_type: string;
        starts: string;
        workout_summary?: {
          duration_active_accum?: number;
          distance_accum?: number;
          file?: { url?: string };
        };
      }>;
      total: number;
      page: number;
      per_page: number;
    };

    return {
      workouts: data.workouts.map((w) => ({
        id: String(w.id),
        name: w.name || `Workout ${w.id}`,
        type: w.workout_type ?? "unknown",
        startedAt: w.starts,
        duration: w.workout_summary?.duration_active_accum
          ? Math.round(w.workout_summary.duration_active_accum)
          : null,
        distance: w.workout_summary?.distance_accum
          ? Math.round(w.workout_summary.distance_accum)
          : null,
        fileUrl: w.workout_summary?.file?.url,
      })),
      total: data.total,
      page: data.page,
      perPage: data.per_page,
    };
  },

  async downloadFile(tokens: TokenSet, workout: Workout): Promise<Buffer> {
    if (!workout.fileUrl) throw new Error("No file URL for workout");
    const resp = await fetch(workout.fileUrl, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!resp.ok) throw new Error(`Wahoo file download failed: ${resp.status}`);
    return Buffer.from(await resp.arrayBuffer());
  },

  async convertToGpx(fileBuffer: Buffer): Promise<string | null> {
    const parsed = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const parser = new FitParser({ force: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parser.parse(fileBuffer as any, (error: unknown, data: any) => {
        if (error) reject(error);
        else resolve(data ?? {});
      });
    });

    const records = (parsed.records ?? []) as Array<{
      position_lat?: number;
      position_long?: number;
      altitude?: number;
      timestamp?: string;
    }>;

    // FIT uses semicircles — convert to degrees
    const SEMICIRCLE_TO_DEG = 180 / Math.pow(2, 31);
    const trackPoints = records
      .filter((r) => r.position_lat != null && r.position_long != null)
      .map((r) => ({
        lat: r.position_lat! * SEMICIRCLE_TO_DEG,
        lon: r.position_long! * SEMICIRCLE_TO_DEG,
        ele: r.altitude,
        time: r.timestamp,
      }));

    if (trackPoints.length < 2) return null;

    return generateGpx({
      name: "Wahoo workout",
      tracks: [trackPoints],
    });
  },

  parseWebhook(body: unknown): WebhookEvent | null {
    const payload = body as {
      event_type?: string;
      user?: { id?: number };
      workout_summary?: {
        id?: number;
        workout?: { id?: number };
        file?: { url?: string };
      };
    };

    if (payload.event_type !== "workout_summary" || !payload.user?.id) return null;

    return {
      eventType: payload.event_type,
      providerUserId: String(payload.user.id),
      workoutId: String(payload.workout_summary?.workout?.id ?? payload.workout_summary?.id ?? ""),
      fileUrl: payload.workout_summary?.file?.url,
    };
  },
};
