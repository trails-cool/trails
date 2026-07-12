/**
 * Regenerate `poi-selectors.sql` from the POI category selectors in
 * `@trails-cool/map-core` — the single source of truth. The flagship import
 * script (`poi-import.sh`, bash + psql, no Node) loads this to classify each
 * extracted OSM element into one row per matching category, mirroring
 * `matchingCategoryIds`.
 *
 * Run after changing `poiCategories`:
 *   npx tsx infrastructure/scripts/gen-poi-selectors-sql.ts
 *
 * `packages/map-core/src/poi-selectors-sql.sync.test.ts` fails CI on drift.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { poiCategories } from "../../packages/map-core/src/poi.ts";

function sqlLiteral(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

const rows = poiCategories.flatMap((cat) =>
  cat.selectors.map((s) => `  (${sqlLiteral(s.key)}, ${sqlLiteral(s.value)}, ${sqlLiteral(cat.id)})`),
);

const sql = `-- GENERATED from @trails-cool/map-core poiCategories. Do not edit by hand;
-- regenerate with: npx tsx infrastructure/scripts/gen-poi-selectors-sql.ts
-- Loaded by poi-import.sh inside the import transaction to classify each
-- extracted OSM element into one row per matching category.
CREATE TEMP TABLE poi_selector (key text, value text, category text) ON COMMIT DROP;
INSERT INTO poi_selector (key, value, category) VALUES
${rows.join(",\n")};
`;

const out = fileURLToPath(new URL("./poi-selectors.sql", import.meta.url));
writeFileSync(out, sql);
console.log(`Wrote ${out}`);
