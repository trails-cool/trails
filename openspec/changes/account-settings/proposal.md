## Why

Users have no way to manage their account after registration. There's no
settings page to edit their profile, manage passkeys, change email, or delete
their account. Passkey count currently shows on the home page as a stopgap,
but it belongs in a dedicated settings area.

## What Changes

- **Account settings page** (`/settings`): central place for account management
- **Profile editing**: update display name and bio
- **Email change**: update email with verification via magic link
- **Passkey management**: view registered passkeys (device type, date added),
  add new passkeys, delete existing ones
- **Account deletion**: delete account and all associated data with confirmation
- Move passkey status display from home page to settings

## Capabilities

### New Capabilities
- `account-settings`: Settings page with profile, security, and account sections

### Modified Capabilities
- `journal-auth`: Passkey management moves from home page prompt to settings;
  add passkey delete functionality

## Impact

- **Files**: New route `apps/journal/app/routes/settings.tsx`, API routes for
  profile update, email change, passkey delete, account delete
- **Database**: No schema changes — uses existing users and credentials tables
- **Routes**: Must register new routes in `apps/journal/app/routes.ts`
