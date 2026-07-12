/**
 * Regenerate `osmium-filters.txt` from the POI category selectors in
 * `@trails-cool/map-core` — the single source of truth for "what is a
 * shelter". Run this after changing `poiCategories`:
 *
 *   pnpm --filter @trails-cool/map-core exec tsx \
 *     ../../infrastructure/brouter-host/poi-extract/gen-osmium-filters.ts
 *
 * The committed file is what the (Node-free) BRouter host reads at extract
 * time. `osmium-filters.sync.test.ts` in map-core fails CI if the two drift.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { osmiumTagFilters } from "../../../packages/map-core/src/poi.ts";

const out = fileURLToPath(new URL("./osmium-filters.txt", import.meta.url));
writeFileSync(out, osmiumTagFilters().join("\n") + "\n");
console.log(`Wrote ${out}`);
