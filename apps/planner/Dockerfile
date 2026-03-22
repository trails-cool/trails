FROM node:24-slim AS base
RUN corepack enable && corepack prepare pnpm@10.6.5 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/planner/package.json apps/planner/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY packages/map/package.json packages/map/
COPY packages/gpx/package.json packages/gpx/
COPY packages/i18n/package.json packages/i18n/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/planner/node_modules ./apps/planner/node_modules
COPY . .
RUN pnpm --filter @trails-cool/planner build

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/planner/build ./apps/planner/build
COPY --from=build /app/apps/planner/server.ts ./apps/planner/server.ts
COPY --from=build /app/apps/planner/app/lib ./apps/planner/app/lib
COPY --from=build /app/apps/planner/package.json ./apps/planner/package.json

WORKDIR /app/apps/planner
EXPOSE 3001
ENV PORT=3001
CMD ["node", "server.ts"]
