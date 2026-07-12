import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { poiCategories } from "./poi.ts";

// The flagship import script (poi-import.sh, bash + psql, no Node) loads the
// committed poi-selectors.sql to classify extracted elements into category
// rows. This test fails CI if that file drifts from the map-core selectors, so
// poiCategories stays the single source of truth. Regenerate with:
//   npx tsx infrastructure/scripts/gen-poi-selectors-sql.ts
describe("poi-selectors.sql", () => {
  it("contains a VALUES row for every selector/category pair", () => {
    const path = fileURLToPath(
      new URL("../../../infrastructure/scripts/poi-selectors.sql", import.meta.url),
    );
    const sql = readFileSync(path, "utf8");
    const expected = poiCategories.flatMap((cat) =>
      cat.selectors.map((s) => `('${s.key}', '${s.value}', '${cat.id}')`),
    );
    for (const row of expected) {
      expect(sql).toContain(row);
    }
    // No extra/stale rows: the count of VALUES tuples equals the selector count.
    const tupleCount = (sql.match(/\(\s*'[^']+',\s*'[^']+',\s*'[^']+'\s*\)/g) ?? []).length;
    expect(tupleCount).toBe(expected.length);
  });
});
