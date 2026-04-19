#!/usr/bin/env -S node --experimental-strip-types
/**
 * Render a trails.cool legal page (Terms / Privacy / Impressum) from its TSX
 * source into plain markdown suitable for `docs/legal-archive/`.
 *
 * Usage (from repo root):
 *   node --experimental-strip-types scripts/render-legal.ts terms   > docs/legal-archive/terms-YYYY-MM-DD.md
 *   node --experimental-strip-types scripts/render-legal.ts privacy > docs/legal-archive/privacy-YYYY-MM-DD.md
 *   node --experimental-strip-types scripts/render-legal.ts imprint > docs/legal-archive/imprint-YYYY-MM-DD.md
 *
 * Strips JSX tags + attributes and resolves `operator.*` placeholders from
 * operator.ts plus `TERMS_VERSION` / `PRIVACY_LAST_UPDATED` from legal.ts so
 * the output is a clean human-readable snapshot.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OPERATOR_FILE = join(REPO_ROOT, "apps/journal/app/lib/operator.ts");
const LEGAL_FILE = join(REPO_ROOT, "apps/journal/app/lib/legal.ts");

const PAGES = {
  terms:   { file: "apps/journal/app/routes/legal.terms.tsx",   title: "Terms of Service — trails.cool" },
  privacy: { file: "apps/journal/app/routes/legal.privacy.tsx", title: "Privacy Policy — trails.cool" },
  imprint: { file: "apps/journal/app/routes/legal.imprint.tsx", title: "Impressum — trails.cool" },
} as const;

type Page = keyof typeof PAGES;

function loadOperator(): Record<string, string> {
  const src = readFileSync(OPERATOR_FILE, "utf8");
  const fields = ["name", "street", "postalCode", "city", "country", "email", "responsiblePerson"];
  const out: Record<string, string> = {};
  for (const f of fields) {
    const m = src.match(new RegExp(`${f}:\\s*"([^"]+)"`));
    out[f] = m ? m[1]! : "";
  }
  return out;
}

function loadLegalConstants(): Record<string, string> {
  const src = readFileSync(LEGAL_FILE, "utf8");
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/export const (\w+)\s*=\s*"([^"]+)"/g)) {
    out[m[1]!] = m[2]!;
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function render(src: string, operator: Record<string, string>, legal: Record<string, string>): string {
  // Resolve operator placeholders
  src = src.replace(/\{operator\.address\.(\w+)\}/g, (_, k: string) => operator[k] ?? "");
  src = src.replace(/\{operator\.(\w+)\}/g, (_, k: string) => operator[k] ?? "");

  // Resolve legal.ts constants
  for (const [name, value] of Object.entries(legal)) {
    src = src.replace(new RegExp(`\\{${escapeRegex(name)}\\}`, "g"), value);
  }

  // Unwrap template literals and explicit single-space expressions
  src = src.replace(/\{`(.*?)`\}/gs, "$1");
  src = src.replace(/\{"\s*"\}/g, " ");

  // Strip common JSX attributes
  src = src.replace(/\s(?:className|href|target|rel|id|name|content|htmlFor)="[^"]*"/g, "");

  // Drop any remaining {expr} blocks (unresolved expressions)
  src = src.replace(/\{[^{}]*\}/g, "");

  // Replace tags with newlines to preserve paragraph structure
  src = src.replace(/<[^>]+>/g, "\n");

  // HTML entity decode (minimal)
  const entities: Array<[string, string]> = [
    ["&apos;", "'"],
    ["&amp;", "&"],
    ["&lt;", "<"],
    ["&gt;", ">"],
    ["&quot;", '"'],
    ["&nbsp;", " "],
  ];
  for (const [e, r] of entities) src = src.split(e).join(r);

  // Collapse blank lines
  const lines = src.split("\n").map((l) => l.replace(/\s+$/, ""));
  const out: string[] = [];
  let prevBlank = false;
  for (const l of lines) {
    if (l.trim() === "") {
      if (!prevBlank && out.length) out.push("");
      prevBlank = true;
    } else {
      out.push(l.trim());
      prevBlank = false;
    }
  }
  return out.join("\n").trim();
}

function main(): number {
  const arg = process.argv[2];
  if (!arg || !(arg in PAGES)) {
    process.stderr.write(`Usage: render-legal.ts {${Object.keys(PAGES).join("|")}}\n`);
    return 2;
  }
  const page = arg as Page;
  const operator = loadOperator();
  const legal = loadLegalConstants();
  let src = readFileSync(join(REPO_ROOT, PAGES[page].file), "utf8");

  // Slice out the JSX tree: everything between `return (` and the closing `);`
  src = src.split(/return \(\s*\n/).slice(-1)[0]!;
  src = src.replace(/\);\s*\}\s*$/, "").trimEnd();

  const body = render(src, operator, legal);
  process.stdout.write(`# ${PAGES[page].title}\n\n${body}\n`);
  return 0;
}

process.exit(main());
