-- Data migration for the deepen-connected-services change.
--
-- Why this lives outside drizzle-kit push:
-- We're (a) renaming `sync_connections` → `connected_services`, (b) collapsing
-- the OAuth-shaped columns (access_token, refresh_token, expires_at) into a
-- polymorphic `credentials` JSONB blob discriminated by `credential_kind`,
-- and (c) adding a `status` column. drizzle-kit push would happily DROP the
-- old columns before we backfill, losing every active Wahoo connection.
--
-- This script reshapes the table into the new layout BEFORE drizzle-kit push
-- diffs against the schema. After it runs, drizzle-kit push has nothing left
-- to do for this table.
--
-- Idempotent: safe to run before every deploy.

DO $$
BEGIN
  -- 1. Rename table if it still has the old name.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'journal' AND table_name = 'sync_connections'
  ) THEN
    ALTER TABLE journal.sync_connections RENAME TO connected_services;
  END IF;

  -- Bail out if the renamed table doesn't exist yet (fresh DB; drizzle-kit
  -- push will create connected_services directly from the schema).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'journal' AND table_name = 'connected_services'
  ) THEN
    RETURN;
  END IF;

  -- 2. Add the new columns (nullable initially so backfill can populate them).
  ALTER TABLE journal.connected_services
    ADD COLUMN IF NOT EXISTS credential_kind text,
    ADD COLUMN IF NOT EXISTS credentials jsonb,
    ADD COLUMN IF NOT EXISTS status text;

  -- 3. Backfill from old token columns if they still exist. Existing rows are
  --    all OAuth (Wahoo), so credential_kind = 'oauth' and the JSONB blob
  --    holds {access_token, refresh_token, expires_at}.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'journal'
      AND table_name = 'connected_services'
      AND column_name = 'access_token'
  ) THEN
    UPDATE journal.connected_services
    SET credential_kind = 'oauth',
        credentials = jsonb_build_object(
          'access_token', access_token,
          'refresh_token', refresh_token,
          'expires_at', to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        ),
        status = COALESCE(status, 'active')
    WHERE credential_kind IS NULL;
  END IF;

  -- 4. Set NOT NULL on the new columns now that they're populated.
  ALTER TABLE journal.connected_services
    ALTER COLUMN credential_kind SET NOT NULL,
    ALTER COLUMN credentials SET NOT NULL,
    ALTER COLUMN status SET NOT NULL;

  -- 5. CHECK constraints. Drop-then-add for idempotency.
  -- 'public' = credential-less public-profile connection (Komoot public
  -- mode, api.sync.komoot.verify.ts). It was missing from the original
  -- list, which made this migration fail against production data on
  -- 2026-06-07 (a komoot public connection existed) and block cd-apps.
  ALTER TABLE journal.connected_services
    DROP CONSTRAINT IF EXISTS connected_services_credential_kind_check;
  ALTER TABLE journal.connected_services
    ADD CONSTRAINT connected_services_credential_kind_check
    CHECK (credential_kind IN ('oauth', 'web-login', 'device', 'public'));

  ALTER TABLE journal.connected_services
    DROP CONSTRAINT IF EXISTS connected_services_status_check;
  ALTER TABLE journal.connected_services
    ADD CONSTRAINT connected_services_status_check
    CHECK (status IN ('active', 'needs_relink', 'revoked'));

  -- 6. Default for status (so future inserts that omit it get 'active').
  ALTER TABLE journal.connected_services
    ALTER COLUMN status SET DEFAULT 'active';

  -- 7. Unique (user_id, provider) — the spec invariant "at most one row per
  --    (user, provider)" was previously enforced only at the application
  --    layer. Lift it into the DB.
  CREATE UNIQUE INDEX IF NOT EXISTS connected_services_user_provider_unique
    ON journal.connected_services (user_id, provider);
END $$;
