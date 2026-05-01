-- Data migration for the wahoo-route-update change.
--
-- Why this lives outside drizzle-kit push:
-- `drizzle-kit push --force` will happily DROP `route_version` and try to add
-- the new unique index on (user_id, route_id, provider), but if any user has
-- successfully pushed multiple versions of a route the duplicate-row check on
-- the new unique would fail. We need to backfill `last_pushed_version` and
-- collapse rows BEFORE drizzle-kit reshapes the table.
--
-- Idempotent: safe to run before every deploy until the old `route_version`
-- column is gone. Once `route_version` is dropped (i.e. drizzle-kit push has
-- run after this script), the body is a no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'journal'
      AND table_name = 'sync_pushes'
      AND column_name = 'route_version'
  ) THEN
    -- 1. Add the new column (nullable) if drizzle-kit push hasn't yet.
    ALTER TABLE journal.sync_pushes
      ADD COLUMN IF NOT EXISTS last_pushed_version integer;

    -- 2. Backfill last_pushed_version from route_version for every row.
    UPDATE journal.sync_pushes
    SET last_pushed_version = route_version
    WHERE last_pushed_version IS NULL;

    -- 3. Collapse rows: per (user_id, route_id, provider), keep the row with
    --    the highest route_version. Ties broken by created_at desc so we keep
    --    the most recent. The kept row's remote_id (if any) is the live one.
    DELETE FROM journal.sync_pushes a
    USING journal.sync_pushes b
    WHERE a.user_id = b.user_id
      AND a.route_id = b.route_id
      AND a.provider = b.provider
      AND (
        a.route_version < b.route_version
        OR (a.route_version = b.route_version AND a.created_at < b.created_at)
      );

    -- 4. Drop the old unique index that includes route_version. The new one
    --    on (user_id, route_id, provider) is created by drizzle-kit push from
    --    the schema definition.
    DROP INDEX IF EXISTS journal.sync_pushes_user_route_version_provider_unique;
  END IF;
END $$;
