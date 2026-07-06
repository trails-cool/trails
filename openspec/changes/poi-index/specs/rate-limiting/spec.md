## REMOVED Requirements

### Requirement: Overpass API rate limit
**Reason**: The `/api/overpass` proxy and its third-party upstream are removed; POIs are served from the instance's own index.
**Migration**: The equivalent limit continues on the replacement endpoint — see "POI API rate limit" below. No client changes; the same error UI handles 429s.

## ADDED Requirements

### Requirement: POI API rate limit
The Planner SHALL limit `/api/pois` requests to 120 per IP per minute to protect the instance's database from abusive clients.

#### Scenario: POI rate limit exceeded
- **WHEN** a single IP exceeds 120 POI requests in one minute
- **THEN** `/api/pois` responds with 429 Too Many Requests
- **AND** no database query is executed for rejected requests
