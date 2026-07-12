import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { osmiumTagFilters } from "./poi.ts";

// The BRouter host reads the committed `osmium-filters.txt` at extract time —
// it has no Node runtime to derive filters from map-core. This test fails CI
// if the file drifts from the selectors, so `poiCategories` stays the single
// source of truth. Regenerate with:
//   npx tsx infrastructure/brouter-host/poi-extract/gen-osmium-filters.ts
describe("osmium-filters.txt", () => {
  it("matches the filters derived from poiCategories", () => {
    const path = fileURLToPath(
      new URL(
        "../../../infrastructure/brouter-host/poi-extract/osmium-filters.txt",
        import.meta.url,
      ),
    );
    const committed = readFileSync(path, "utf8").trimEnd();
    expect(committed).toBe(osmiumTagFilters().join("\n"));
  });
});
