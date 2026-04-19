#!/usr/bin/env python3
"""
Render a trails.cool legal page (Terms / Privacy / Impressum) from its TSX
source into plain markdown suitable for `docs/legal-archive/`.

Usage (from repo root):
    python3 scripts/render-legal.py terms   > docs/legal-archive/terms-YYYY-MM-DD.md
    python3 scripts/render-legal.py privacy > docs/legal-archive/privacy-YYYY-MM-DD.md
    python3 scripts/render-legal.py imprint > docs/legal-archive/imprint-YYYY-MM-DD.md

Strips JSX tags + attributes and resolves the `operator.*` placeholders
from `apps/journal/app/lib/operator.ts` so the output is a clean
human-readable snapshot.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
OPERATOR_FILE = REPO_ROOT / "apps/journal/app/lib/operator.ts"
LEGAL_FILE = REPO_ROOT / "apps/journal/app/lib/legal.ts"

PAGES = {
    "terms":   REPO_ROOT / "apps/journal/app/routes/legal.terms.tsx",
    "privacy": REPO_ROOT / "apps/journal/app/routes/legal.privacy.tsx",
    "imprint": REPO_ROOT / "apps/journal/app/routes/legal.imprint.tsx",
}

TITLES = {
    "terms":   "Terms of Service — trails.cool",
    "privacy": "Privacy Policy — trails.cool",
    "imprint": "Impressum — trails.cool",
}


def load_operator() -> dict[str, str]:
    src = OPERATOR_FILE.read_text()
    fields = ("name", "street", "postalCode", "city", "country", "email", "responsiblePerson")
    return {
        f: m.group(1) if (m := re.search(rf'{f}:\s*"([^"]+)"', src)) else ""
        for f in fields
    }


def load_legal_constants() -> dict[str, str]:
    """Exported top-level `export const NAME = "value";` from legal.ts."""
    src = LEGAL_FILE.read_text()
    return dict(re.findall(r'export const (\w+)\s*=\s*"([^"]+)"', src))


def render(src: str, operator: dict[str, str], legal: dict[str, str]) -> str:
    # Resolve operator placeholders
    src = re.sub(r'\{operator\.address\.(\w+)\}', lambda m: operator.get(m.group(1), ""), src)
    src = re.sub(r'\{operator\.(\w+)\}', lambda m: operator.get(m.group(1), ""), src)

    # Resolve legal.ts constants (TERMS_VERSION, PRIVACY_LAST_UPDATED, …)
    for name, value in legal.items():
        src = re.sub(r'\{' + re.escape(name) + r'\}', value, src)

    # Unwrap template literals and explicit single-space expressions
    src = re.sub(r'\{`(.*?)`\}', r'\1', src)
    src = re.sub(r'\{"\s*"\}', ' ', src)

    # Strip common JSX attributes we don't want in prose
    src = re.sub(r'\s(?:className|href|target|rel|id|name|content|htmlFor)="[^"]*"', '', src)

    # Drop any remaining {expr} blocks (unresolved expressions)
    src = re.sub(r'\{[^{}]*\}', '', src)

    # Replace tags with newlines to preserve paragraph structure
    src = re.sub(r'<[^>]+>', '\n', src)

    # HTML entity decode (minimal)
    for entity, replacement in (
        ("&apos;", "'"),
        ("&amp;", "&"),
        ("&lt;", "<"),
        ("&gt;", ">"),
        ("&quot;", '"'),
        ("&nbsp;", " "),
    ):
        src = src.replace(entity, replacement)

    # Collapse blank lines
    lines = [ln.rstrip() for ln in src.splitlines()]
    out: list[str] = []
    prev_blank = False
    for ln in lines:
        if ln.strip() == "":
            if not prev_blank and out:
                out.append("")
            prev_blank = True
        else:
            out.append(ln.strip())
            prev_blank = False
    return "\n".join(out).strip()


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in PAGES:
        sys.stderr.write(f"Usage: {sys.argv[0]} {{{'|'.join(PAGES)}}}\n")
        return 2

    page = sys.argv[1]
    operator = load_operator()
    legal = load_legal_constants()
    src = PAGES[page].read_text()

    # Slice out the JSX tree: everything between "return (" and the closing ");"
    src = re.split(r'return \(\s*\n', src, maxsplit=1)[-1]
    src = re.sub(r'\);\s*\}\s*$', '', src.rstrip())

    body = render(src, operator, legal)
    print(f"# {TITLES[page]}\n\n{body}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
