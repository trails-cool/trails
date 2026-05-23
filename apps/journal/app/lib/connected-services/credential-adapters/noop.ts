// No-op CredentialAdapter for providers whose credentials never expire and
// cannot be refreshed (e.g. Komoot basic-auth, public-mode connections).

import type { CredentialAdapter, Credentials } from "../types.ts";

export const noopCredentialAdapter: CredentialAdapter<Credentials> = {
  isExpired: () => false,
  async refresh(creds) {
    return creds;
  },
};
