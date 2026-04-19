# scripts

One-off CLIs for maintenance tasks that don't belong inside any of the
apps or packages. Small enough to live in a single file each.

This folder is a pnpm workspace (`@trails-cool/scripts`) purely so TypeScript
has a home to resolve `@types/node` from — it isn't published, bundled, or
deployed. Each script is a self-contained `.ts` file run with
`node --experimental-strip-types`.

## Contents

| Script | Purpose |
|---|---|
| `render-legal.ts` | Render a legal page (Terms / Privacy / Imprint) from its TSX source to plain markdown for `docs/legal-archive/`. See [`docs/legal-archive/README.md`](../docs/legal-archive/README.md). |
| `check-dockerfiles.sh` | Bash script run in CI to verify every workspace package is COPY'd into each app's Dockerfile. |

## Adding a script

1. Drop the file in this folder (`.ts` preferred; shell is fine for
   filesystem/docker glue).
2. For TypeScript, `tsconfig.json` already picks up every `*.ts` in this
   directory.
3. Run it with `node --experimental-strip-types scripts/<name>.ts <args>`.
4. Document purpose + invocation in the table above.

## Why not per-package scripts?

Some things (Dockerfile audits, legal-archive rendering, DB one-offs) don't
belong inside any single workspace. Keeping them here avoids cross-package
dependencies and keeps the app/package roots focused on product code.
