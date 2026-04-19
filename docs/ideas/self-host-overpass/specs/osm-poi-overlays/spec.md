## MODIFIED Requirements

### Requirement: Overpass rate limit handling
The Planner SHALL handle Overpass API rate limits gracefully. POI queries SHALL be sent to the Planner's own `/api/overpass` proxy route, not to any public Overpass endpoint.

#### Scenario: Rate limited response
- **WHEN** the `/api/overpass` proxy returns a 429 status (either from the proxy's own session rate limiter or propagated from the upstream Overpass service)
- **THEN** the Planner shows a temporary "POI data unavailable — try again shortly" message and retries with exponential backoff

#### Scenario: Overpass unavailable
- **WHEN** the `/api/overpass` proxy is unreachable or returns a 5xx status
- **THEN** the Planner shows a message and tile overlays continue to function normally

#### Scenario: No fallback to public endpoints
- **WHEN** the `/api/overpass` proxy returns any error
- **THEN** the Planner does NOT fall back to a public Overpass endpoint; the error surfaces to the user via the existing POI error UI
