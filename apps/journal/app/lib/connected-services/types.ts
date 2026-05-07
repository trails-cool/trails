// Types for the Connected Services architecture. See docs/adr/0001-0003 and
// CONTEXT.md (Connected Services section).

export type CredentialKind = "oauth" | "web-login" | "device";

export type ConnectionStatus = "active" | "needs_relink" | "revoked";

// OAuth credential blob (stored in connected_services.credentials when
// credential_kind = 'oauth'). expires_at is an ISO-8601 UTC string so the
// JSONB blob is round-trip safe; the manager parses it into a Date as needed.
export interface OAuthCredentials {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

// web-login (Komoot) and device (Apple Health) blob shapes will be defined
// alongside their respective consumer changes. The kinds are reserved here
// so the manager can switch on them without a follow-up enum migration.
export type Credentials = OAuthCredentials | Record<string, unknown>;

export interface ConnectedService {
  id: string;
  userId: string;
  provider: string;
  credentialKind: CredentialKind;
  credentials: Credentials;
  status: ConnectionStatus;
  providerUserId: string | null;
  grantedScopes: string[];
  createdAt: Date;
}

// Returned by CredentialAdapter.refresh when the credential is permanently
// invalid (e.g. revoked refresh token). Manager flips the connection's
// status to 'needs_relink' and surfaces this to callers.
export class NeedsRelinkError extends Error {
  reason: string;
  constructor(reason: string) {
    super(`Connection needs relinking: ${reason}`);
    this.name = "NeedsRelinkError";
    this.reason = reason;
  }
}

// CredentialAdapter is implemented per credential_kind. The adapter owns
// the credential lifecycle for that kind — nothing else.
export interface CredentialAdapter<C extends Credentials = Credentials> {
  // Returns refreshed credentials, or throws NeedsRelinkError on permanent
  // failure. Implementations should be idempotent w.r.t. already-fresh
  // credentials (callers may invoke even when not strictly expired).
  refresh(credentials: C, providerConfig: ProviderOAuthConfig): Promise<C>;
  // Best-effort revocation at the provider's end on unlink. Failures
  // should be swallowed by the caller — the local row is deleted regardless.
  revoke?(credentials: C, providerConfig: ProviderOAuthConfig): Promise<void>;
  // Returns true if the credential is expired (or close enough that the
  // caller should refresh before using it). Manager calls this from
  // withFreshCredentials.
  isExpired(credentials: C): boolean;
}

// OAuth-specific config carried on the provider manifest. Used by the oauth
// CredentialAdapter to build refresh requests without hard-coding Wahoo URLs.
export interface ProviderOAuthConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  // Optional revoke endpoint (e.g. Wahoo's DELETE /v1/permissions). When
  // absent, revoke is a no-op.
  revokeUrl?: string;
}

// Thrown when withFreshCredentials is called against a connection whose
// status is not 'active'. Caller should surface a re-link prompt.
export class ConnectionNotActiveError extends Error {
  status: ConnectionStatus;
  constructor(status: ConnectionStatus) {
    super(`Connection status is ${status}; cannot use until re-linked`);
    this.name = "ConnectionNotActiveError";
    this.status = status;
  }
}
