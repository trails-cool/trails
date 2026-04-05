-- Enable pg_stat_statements for query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Read-only user for Grafana dashboards
-- Password is set via: ALTER ROLE grafana_reader PASSWORD '<from SOPS>'
-- Run by cd-infra deploy script after container start

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'grafana_reader') THEN
    CREATE ROLE grafana_reader WITH LOGIN;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE trails TO grafana_reader;
GRANT USAGE ON SCHEMA public TO grafana_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO grafana_reader;

-- Also grant on planner/journal schemas if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'planner') THEN
    GRANT USAGE ON SCHEMA planner TO grafana_reader;
    GRANT SELECT ON ALL TABLES IN SCHEMA planner TO grafana_reader;
    ALTER DEFAULT PRIVILEGES IN SCHEMA planner GRANT SELECT ON TABLES TO grafana_reader;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'journal') THEN
    GRANT USAGE ON SCHEMA journal TO grafana_reader;
    GRANT SELECT ON ALL TABLES IN SCHEMA journal TO grafana_reader;
    ALTER DEFAULT PRIVILEGES IN SCHEMA journal GRANT SELECT ON TABLES TO grafana_reader;
  END IF;
END
$$;
