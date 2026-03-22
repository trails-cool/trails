## 1. Docker Compose Dev Services

- [x] 1.1 Add BRouter service to docker-compose.dev.yml with segment volume
- [x] 1.2 Add BRouter profiles volume (included in BRouter Dockerfile)
- [ ] 1.3 Verify PostgreSQL + BRouter start with `docker compose -f docker-compose.dev.yml up -d` (needs Docker)

## 2. Segment Download

- [x] 2.1 Create scripts/download-dev-segments.sh that downloads E10_N50.rd5 to BRouter volume
- [x] 2.2 Skip download if segment already exists in volume

## 3. Database Setup

- [x] 3.1 Add `pnpm db:push` script that runs `drizzle-kit push` against local PostgreSQL
- [ ] 3.2 Verify planner and journal schemas are created

## 4. Dev Orchestration

- [x] 4.1 Create scripts/dev.sh that starts Docker services, waits for health, pushes schema, starts apps
- [x] 4.2 Add `pnpm dev:full` script to root package.json
- [x] 4.3 Add `pnpm dev:services` script to start only Docker services (for running apps separately)

## 5. Documentation & Verification

- [x] 5.1 Update README.md with local dev prerequisites (Docker, pnpm) and setup instructions
- [ ] 5.2 Test full flow: start dev stack → create session → compute route with Berlin waypoints
