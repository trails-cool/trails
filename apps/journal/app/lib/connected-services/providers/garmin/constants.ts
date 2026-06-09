// Garmin endpoint constants — own module so manifest.ts, webhook.ts,
// import.server.ts, and backfill.ts can all use them without forming
// an import cycle (manifest → webhook → import.server must never loop
// back into manifest for a value needed at module-eval time).

export const GARMIN_API = "https://apis.garmin.com";
export const GARMIN_AUTHORIZE = "https://connect.garmin.com/oauth2Confirm";
export const GARMIN_TOKEN = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
