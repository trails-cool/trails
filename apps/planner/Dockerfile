FROM node:25-slim AS base
RUN npm install -g pnpm@10.6.5
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/planner/package.json apps/planner/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY packages/map/package.json packages/map/
COPY packages/gpx/package.json packages/gpx/
COPY packages/i18n/package.json packages/i18n/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/ ./
COPY . .
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    --mount=type=secret,id=SENTRY_RELEASE \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN 2>/dev/null)" \
    SENTRY_RELEASE="$(cat /run/secrets/SENTRY_RELEASE 2>/dev/null)" \
    pnpm --filter @trails-cool/planner build

FROM base AS runtime
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/planner/node_modules ./apps/planner/node_modules
COPY --from=build /app/apps/planner/build ./apps/planner/build
COPY --from=build /app/apps/planner/server.ts ./apps/planner/server.ts
COPY --from=build /app/apps/planner/app/lib ./apps/planner/app/lib
COPY --from=build /app/apps/planner/package.json ./apps/planner/package.json
COPY --from=build /app/packages ./packages

WORKDIR /app/apps/planner
USER app
EXPOSE 3001
ENV PORT=3001
CMD ["node", "--experimental-strip-types", "server.ts"]
