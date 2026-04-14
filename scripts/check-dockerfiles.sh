#!/usr/bin/env bash
# Verify all workspace packages are listed in Dockerfiles.
# Run in CI to catch missing COPY lines when new packages are added.
set -euo pipefail

errors=0

for pkg_json in packages/*/package.json; do
  pkg_dir=$(dirname "$pkg_json")  # e.g. packages/jobs
  pkg_name=$(basename "$pkg_dir")  # e.g. jobs

  for dockerfile in apps/*/Dockerfile; do
    app=$(basename "$(dirname "$dockerfile")")
    if ! grep -q "COPY ${pkg_dir}/package.json" "$dockerfile"; then
      echo "ERROR: $dockerfile is missing COPY for $pkg_dir/package.json"
      errors=$((errors + 1))
    fi
  done
done

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "$errors missing package(s) in Dockerfiles. Add COPY lines to the deps stage."
  exit 1
fi

echo "All workspace packages present in all Dockerfiles."
