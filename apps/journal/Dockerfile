FROM node:25-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.6.5
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/journal/package.json apps/journal/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY packages/map/package.json packages/map/
COPY packages/gpx/package.json packages/gpx/
COPY packages/i18n/package.json packages/i18n/
COPY packages/sentry-config/package.json packages/sentry-config/
COPY packages/api/package.json packages/api/
COPY packages/map-core/package.json packages/map-core/
COPY packages/db/package.json packages/db/
COPY packages/jobs/package.json packages/jobs/
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG SENTRY_RELEASE
COPY --from=deps /app/ ./
COPY . .
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN 2>/dev/null | tr -d '\n\r')" \
    SENTRY_RELEASE="$SENTRY_RELEASE" \
    pnpm --filter @trails-cool/journal build

FROM base AS runtime
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/journal/node_modules ./apps/journal/node_modules
COPY --from=build /app/apps/journal/build ./apps/journal/build
COPY --from=build /app/apps/journal/server.ts ./apps/journal/server.ts
COPY --from=build /app/apps/journal/app/lib ./apps/journal/app/lib
COPY --from=build /app/apps/journal/app/jobs ./apps/journal/app/jobs
COPY --from=build /app/apps/journal/package.json ./apps/journal/package.json
COPY --from=build /app/packages ./packages

WORKDIR /app/apps/journal
USER app
EXPOSE 3000
ENV PORT=3000
CMD ["node", "--experimental-strip-types", "server.ts"]
