// Provider barrel. Imports every provider manifest and registers it with
// the registry. Adding a provider: import its manifest here and add the
// `registerManifest(...)` call.

import { registerManifest } from "../registry.ts";
import { wahooManifest } from "./wahoo/manifest.ts";
import { komootManifest } from "./komoot/manifest.ts";
import { garminManifest } from "./garmin/manifest.ts";

registerManifest(wahooManifest);
registerManifest(komootManifest);
registerManifest(garminManifest);

// Re-export so callers (mostly tests) can grab a manifest directly.
export { wahooManifest, komootManifest, garminManifest };
