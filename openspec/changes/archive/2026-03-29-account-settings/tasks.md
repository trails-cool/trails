## 1. Settings Route & Layout

- [x] 1.1 Create `apps/journal/app/routes/settings.tsx` with loader auth guard (redirect to `/auth/login` if unauthenticated)
- [x] 1.2 Register route in `apps/journal/app/routes.ts`
- [x] 1.3 Layout with three sections: Profile, Security, Account (anchor links for navigation)

## 2. Profile Section

- [x] 2.1 Display name and bio form fields, pre-filled from current user data
- [x] 2.2 Create `POST /api/settings/profile` action to update display name and bio
- [x] 2.3 Register API route in `routes.ts`
- [x] 2.4 Success/error feedback on save

## 3. Security Section — Passkey Management

- [x] 3.1 Load user's credentials in settings loader (device type, transports, createdAt)
- [x] 3.2 Render passkey list with friendly transport labels and registration date
- [x] 3.3 Add passkey button using existing `addPasskeyStart`/`addPasskeyFinish` flow, hidden when WebAuthn unsupported
- [x] 3.4 Create `POST /api/settings/passkey/delete` action to remove a credential by ID
- [x] 3.5 Register API route in `routes.ts`
- [x] 3.6 Delete confirmation dialog, with last-passkey warning when applicable

## 4. Account Section — Email Change

- [x] 4.1 Email display with "Change" button revealing input for new email
- [x] 4.2 Create `initiateEmailChange(userId, newEmail)` in auth.server.ts — generates magic token with `newEmail` metadata
- [x] 4.3 Create `POST /api/settings/email` action to initiate email change
- [x] 4.4 Register API route in `routes.ts`
- [x] 4.5 Update `verifyMagicToken` to handle email-change tokens (update user email)
- [x] 4.6 Send verification email to new address using existing email templates

## 5. Account Section — Deletion

- [x] 5.1 "Delete account" danger button at bottom of settings page
- [x] 5.2 Confirmation modal requiring username input to proceed
- [x] 5.3 Create `POST /api/settings/delete-account` action — cascading delete, destroy session, redirect to home
- [x] 5.4 Register API route in `routes.ts`

## 6. Navigation

- [x] 6.1 Add "Settings" link to Journal nav for authenticated users
- [x] 6.2 Move passkey count display from home page to settings security section

## 7. i18n

- [x] 7.1 Add translation keys for all settings UI text (en + de)

## 8. Testing

### Unit tests (Vitest)
- [x] 8.1 Profile update: valid input saves, empty display name falls back to username
- [x] 8.2 Passkey delete: removes credential, rejects invalid credential ID, allows deleting last passkey
- [x] 8.3 Email change: creates token for new email, rejects duplicate email, rejects same-as-current email
- [x] 8.4 Account deletion: cascading delete removes user + credentials + tokens, destroys session

### E2E tests (Playwright)
- [x] 8.5 Auth guard: unauthenticated user visiting `/settings` is redirected to `/auth/login`
- [x] 8.6 Profile editing: log in, navigate to settings, update display name and bio, verify changes persist after reload, verify public profile reflects changes
- [x] 8.7 Passkey management: log in, navigate to security section, add passkey (virtual WebAuthn authenticator), verify it appears in list, delete it, verify removed
- [x] 8.8 Delete last passkey: delete only passkey, verify warning modal appears, confirm deletion, verify magic link login still works
- [x] 8.9 Email change: initiate email change, follow verification link (dev mode), verify email updated in settings
- [x] 8.10 Account deletion: click delete, type wrong username (verify blocked), type correct username, confirm, verify redirected to home and session destroyed
- [x] 8.11 Navigation: verify "Settings" link appears in nav when logged in, not visible when logged out
