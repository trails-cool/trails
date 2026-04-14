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

# Check that COPY paths from the build stage exist in the source tree.
# These are app-specific paths (app/lib, app/jobs, etc.) that may not exist yet.
for dockerfile in apps/*/Dockerfile; do
  app_dir=$(dirname "$dockerfile")  # e.g. apps/journal
  grep 'COPY --from=build /app/'"$app_dir"'/' "$dockerfile" | while read -r line; do
    # Extract the source path from: COPY --from=build /app/apps/journal/app/jobs ./apps/journal/app/jobs
    src_path=$(echo "$line" | sed 's|.*COPY --from=build /app/||; s| .*||')
    # Skip build artifacts (created during docker build, not in source tree)
    case "$src_path" in */build|*/build/*|*/node_modules|*/node_modules/*) continue ;; esac
    if [ ! -e "$src_path" ]; then
      echo "ERROR: $dockerfile references $src_path but it does not exist"
      errors=$((errors + 1))
    fi
  done
done

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "$errors error(s) in Dockerfiles."
  exit 1
fi

echo "All Dockerfile references verified."
