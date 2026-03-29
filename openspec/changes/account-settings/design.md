## Context

Users register and log in via passkeys or magic links. After that, there's no
way to manage their account. The user profile page (`/users/:username`) is
public-facing and read-only. Account management needs a private settings page.

The `users` table already has `displayName` and `bio` columns. The
`credentials` table stores `deviceType`, `transports`, and `createdAt` per
passkey — enough to show a meaningful list.

## Goals / Non-Goals

**Goals:**
- Single settings page with sections for profile, security, and account
- Passkey management: list, add, delete
- Profile editing: display name, bio
- Email change with verification
- Account deletion with confirmation

**Non-Goals:**
- Avatar/photo upload (requires S3 — see activity-photos spec)
- Notification preferences (no notifications yet)
- Privacy settings (route visibility is in route-sharing spec)
- Two-factor authentication (passkeys already provide strong auth)
- Session management / "log out everywhere"

## Decisions

### D1: Single settings page with sections

One route at `/settings` with anchor-linked sections rather than separate
sub-pages. Keeps navigation simple and avoids route proliferation.

Sections:
- **Profile** — display name, bio
- **Security** — passkeys list, add passkey button
- **Account** — email, delete account

### D2: Profile editing

Simple form with display name and bio fields. Submit via POST to
`/api/settings/profile`. No real-time validation needed — just save on submit.

Bio is plain text, max 160 characters (like a social bio).

### D3: Passkey management

List all credentials for the current user, showing:
- Device type (from `deviceType` column, e.g., "singleDevice" / "multiDevice")
- Transport hints (from `transports`, e.g., "internal", "usb", "ble", "nfc")
- Date registered (from `createdAt`)
- Delete button (with confirmation)

Friendly labels derived from transports:
- `internal` → "This device"
- `usb` → "Security key"
- `ble` → "Bluetooth"
- `hybrid` → "Phone or tablet"
- fallback → "Passkey"

Add passkey button reuses the existing `addPasskeyStart` / `addPasskeyFinish`
flow from auth.server.ts.

Deleting the last passkey is allowed — user can still log in via magic link.
Show a warning when deleting the last one.

### D4: Email change

Two-step flow:
1. User enters new email → server sends magic link to the **new** email
2. User clicks link → email is updated

This ensures ownership of the new address. The old email is not notified
(simplicity; can add later if needed).

New server function: `initiateEmailChange(userId, newEmail)` creates a
magic token with a `newEmail` field, sends verification to the new address.
New verify handler recognizes email-change tokens and updates the user record.

### D5: Account deletion

- Button at bottom of settings page, styled as danger
- Confirmation modal: "This will permanently delete your account and all your
  data. Type your username to confirm."
- Server-side: cascading delete via DB foreign keys (credentials, magic tokens,
  routes, activities all cascade from users)
- After deletion: destroy session, redirect to home page

### D6: Navigation

Add "Settings" link to the user dropdown/nav when logged in. Links to
`/settings`. Must be registered in `routes.ts`.

### D7: Auth guard

Settings page requires authentication. Loader checks session and redirects to
`/auth/login` if not logged in.

## Risks / Trade-offs

- **Email change without old-email notification**: Simpler but less secure.
  If an attacker has session access, they could change email silently. Mitigate:
  magic link to new address still required. Acceptable for now.
- **Deleting last passkey**: User relies entirely on magic links. Acceptable
  since magic links are a first-class auth method.
