// OAuth state encoding for the connect/callback flow. The state param is
// reflected back to the callback unchanged, so we use it to carry
// post-callback intent (where to return to, whether a push should resume).

export interface PushOAuthState {
  pushAfter?: { routeId: string };
  returnTo?: string;
}

export function encodeOAuthState(state: PushOAuthState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeOAuthState(raw: string | null | undefined): PushOAuthState {
  if (!raw) return {};
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as PushOAuthState;
    return typeof parsed === "object" && parsed != null ? parsed : {};
  } catch {
    return {};
  }
}
