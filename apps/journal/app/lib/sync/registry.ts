import type { SyncProvider } from "./types.ts";
import { wahooProvider } from "./providers/wahoo.ts";

const providers: SyncProvider[] = [wahooProvider];

export function getProvider(id: string): SyncProvider | undefined {
  return providers.find((p) => p.id === id);
}

export function getAllProviders(): SyncProvider[] {
  return providers;
}
