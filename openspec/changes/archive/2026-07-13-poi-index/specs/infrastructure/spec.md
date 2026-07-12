## ADDED Requirements

### Requirement: POI extract pipeline on the BRouter host
The BRouter host SHALL run a scheduled job (monthly by default) that downloads an OSM data file, filters it to the planner's POI category selectors with osmium, and publishes the resulting artifact with a checksum-and-timestamp manifest at a vSwitch-only URL via the existing Caddy sidecar. Transient working data SHALL live under the `trails` user's directory and be cleaned up after each run.

#### Scenario: Monthly extract published
- **WHEN** the scheduled extract job completes
- **THEN** a fresh artifact and manifest are available to the flagship over the vSwitch
- **AND** the planet working files are removed from disk

#### Scenario: Artifact not publicly reachable
- **WHEN** a host outside the vSwitch requests the artifact URL
- **THEN** the request is refused

### Requirement: POI import job on the flagship
The flagship SHALL run a scheduled import job that fetches the artifact over the vSwitch, verifies its checksum, loads it into the staging table, and performs the guarded atomic swap. Job outcome and index age SHALL be visible in the monitoring stack.

#### Scenario: Import failure is visible
- **WHEN** an import run fails (fetch, checksum, load, or guard)
- **THEN** the failure is recorded in metrics/logs and surfaces on the Grafana planner dashboard
