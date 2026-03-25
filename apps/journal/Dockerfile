FROM node:25-slim AS base
RUN corepack enable && corepack prepare pnpm@10.6.5 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/journal/package.json apps/journal/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY packages/map/package.json packages/map/
COPY packages/gpx/package.json packages/gpx/
COPY packages/i18n/package.json packages/i18n/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_RELEASE
COPY --from=deps /app/ ./
COPY . .
RUN pnpm --filter @trails-cool/journal build

FROM base AS runtime
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/journal/node_modules ./apps/journal/node_modules
COPY --from=build /app/apps/journal/build ./apps/journal/build
COPY --from=build /app/apps/journal/package.json ./apps/journal/package.json
COPY --from=build /app/packages ./packages

WORKDIR /app/apps/journal
USER app
EXPOSE 3000
ENV PORT=3000
CMD ["npx", "react-router-serve", "./build/server/index.js"]
