// Komoot provider manifest.
//
// Komoot supports two credential modes:
//   public       — unauthenticated ownership verification via bio link
//   authenticated — email + AES-256-GCM encrypted password
//
// Neither mode uses OAuth; credentials are managed via a custom connect page.

import { noopCredentialAdapter } from "../../credential-adapters/noop.ts";
import type { ProviderManifest } from "../../registry.ts";
import { komootImporter } from "./importer.ts";

export const komootManifest: ProviderManifest = {
  id: "komoot",
  displayName: "Komoot",
  credentialKind: "web-login",
  credentialAdapter: noopCredentialAdapter,
  connectUrl: "/settings/connections/komoot",
  importer: komootImporter,
};
