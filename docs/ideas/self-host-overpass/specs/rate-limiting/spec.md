## ADDED Requirements

### Requirement: Overpass proxy rate limit
The Planner SHALL limit Overpass queries on the `/api/overpass` proxy route to 20 per session per minute, with a burst allowance of 5.

#### Scenario: Overpass rate limit exceeded
- **WHEN** a session sends more than 20 Overpass queries within 60 seconds (beyond the burst allowance)
- **THEN** the server responds with 429 and the request is NOT forwarded to the upstream Overpass service

#### Scenario: Normal browsing within limit
- **WHEN** a session pans and zooms the map at a realistic pace (well under 20 queries/minute)
- **THEN** all queries are forwarded to the upstream Overpass service without rate-limit rejections
