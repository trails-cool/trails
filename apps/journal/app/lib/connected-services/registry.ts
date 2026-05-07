// Provider registry. Each provider lives in providers/<name>/ with a
// manifest.ts that declares its credential_kind and capability adapters.
// Adding a provider is one new directory plus one import line below.
//
// See docs/adr/0002 (no unified SyncProvider interface; capabilities are
// separate seams) and CONTEXT.md (Connected Services).

import type {
  CredentialAdapter,
  CredentialKind,
  ProviderOAuthConfig,
} from "./types.ts";

// Capability seams. A provider implements only the subset that applies.

export interface ImportableList {
  workouts: ImportableWorkout[];
  total: number;
  page: number;
  perPage: number;
}

export interface ImportableWorkout {
  id: string;
  name: string;
  type: string;
  startedAt: string;
  duration: number | null;
  distance: number | null;
  fileUrl?: string;
}

export interface ImportResult {
  activityId: string;
  hadGeometry: boolean;
}

export interface RoutePushInput {
  routeId: string;
  routeName: string;
  description?: string;
  gpx: string;
  startLat: number;
  startLng: number;
  distance: number;
  ascent: number;
  localVersion: number;
}

export interface RoutePushResult {
  remoteId: string;
  // Local route version that was pushed — written into sync_pushes.last_pushed_version
  // by the caller for idempotency.
  version: number;
}

export interface WebhookEvent {
  eventType: string;
  providerUserId: string;
  workoutId: string;
  fileUrl?: string;
}

// CapabilityContext gives capability adapters the tools they need without
// exposing the manager's internals. Adapters call ctx.withFreshCredentials
// to obtain valid credentials for any provider HTTP call.
export interface CapabilityContext {
  serviceId: string;
  withFreshCredentials<T>(
    fn: (credentials: unknown) => Promise<T>,
  ): Promise<T>;
}

export interface Importer {
  listImportable(ctx: CapabilityContext, page: number): Promise<ImportableList>;
  importOne(ctx: CapabilityContext, workoutId: string): Promise<ImportResult>;
}

export interface RoutePusher {
  pushRoute(ctx: CapabilityContext, input: RoutePushInput): Promise<RoutePushResult>;
}

export interface WebhookReceiver {
  parseWebhook(body: unknown): WebhookEvent | null;
  handle(event: WebhookEvent): Promise<void>;
}

export interface ProviderManifest {
  id: string;
  displayName: string;
  credentialKind: CredentialKind;
  // Per-kind credential adapter. Multiple providers can share the same
  // adapter (oauth, web-login, device).
  credentialAdapter: CredentialAdapter;
  // OAuth-specific config; only required when credentialKind === 'oauth'.
  oauthConfig?: ProviderOAuthConfig;
  // OAuth scopes requested at connect time. Wahoo grants all-or-nothing.
  scopes?: string[];
  // OAuth authorization URL builder (for the connect flow).
  buildAuthUrl?: (redirectUri: string, state: string) => string;
  // OAuth code exchange (for the callback). Returns the credential blob to
  // store and the granted scopes.
  exchangeCode?: (
    code: string,
    redirectUri: string,
  ) => Promise<{
    credentials: unknown;
    providerUserId: string | null;
    grantedScopes: string[];
  }>;
  // Capability adapters. Each is optional — providers implement only what
  // they support.
  importer?: Importer;
  routePusher?: RoutePusher;
  webhookReceiver?: WebhookReceiver;
}

// The registry. Imported manifests are kept in an internal map so callers
// can look up by provider id. Adding a provider: import its manifest below
// and add it to PROVIDERS.
//
// Manifests are registered at module load via registerManifest() rather
// than imported directly, so the registry doesn't depend on providers/.
// Each provider's barrel (providers/<name>/index.ts) calls register at import.

const PROVIDERS: Record<string, ProviderManifest> = {};

export function registerManifest(manifest: ProviderManifest): void {
  PROVIDERS[manifest.id] = manifest;
}

export function getManifest(providerId: string): ProviderManifest | null {
  return PROVIDERS[providerId] ?? null;
}

export function getAllManifests(): ProviderManifest[] {
  return Object.values(PROVIDERS);
}
