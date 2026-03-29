## 1. Settings Route & Layout

- [ ] 1.1 Create `apps/journal/app/routes/settings.tsx` with loader auth guard (redirect to `/auth/login` if unauthenticated)
- [ ] 1.2 Register route in `apps/journal/app/routes.ts`
- [ ] 1.3 Layout with three sections: Profile, Security, Account (anchor links for navigation)

## 2. Profile Section

- [ ] 2.1 Display name and bio form fields, pre-filled from current user data
- [ ] 2.2 Create `POST /api/settings/profile` action to update display name and bio
- [ ] 2.3 Register API route in `routes.ts`
- [ ] 2.4 Success/error feedback on save

## 3. Security Section — Passkey Management

- [ ] 3.1 Load user's credentials in settings loader (device type, transports, createdAt)
- [ ] 3.2 Render passkey list with friendly transport labels and registration date
- [ ] 3.3 Add passkey button using existing `addPasskeyStart`/`addPasskeyFinish` flow, hidden when WebAuthn unsupported
- [ ] 3.4 Create `POST /api/settings/passkey/delete` action to remove a credential by ID
- [ ] 3.5 Register API route in `routes.ts`
- [ ] 3.6 Delete confirmation dialog, with last-passkey warning when applicable

## 4. Account Section — Email Change

- [ ] 4.1 Email display with "Change" button revealing input for new email
- [ ] 4.2 Create `initiateEmailChange(userId, newEmail)` in auth.server.ts — generates magic token with `newEmail` metadata
- [ ] 4.3 Create `POST /api/settings/email` action to initiate email change
- [ ] 4.4 Register API route in `routes.ts`
- [ ] 4.5 Update `verifyMagicToken` to handle email-change tokens (update user email)
- [ ] 4.6 Send verification email to new address using existing email templates

## 5. Account Section — Deletion

- [ ] 5.1 "Delete account" danger button at bottom of settings page
- [ ] 5.2 Confirmation modal requiring username input to proceed
- [ ] 5.3 Create `POST /api/settings/delete-account` action — cascading delete, destroy session, redirect to home
- [ ] 5.4 Register API route in `routes.ts`

## 6. Navigation

- [ ] 6.1 Add "Settings" link to Journal nav for authenticated users
- [ ] 6.2 Move passkey count display from home page to settings security section

## 7. i18n

- [ ] 7.1 Add translation keys for all settings UI text (en + de)

## 8. Testing

### Unit tests (Vitest)
- [ ] 8.1 Profile update: valid input saves, empty display name falls back to username
- [ ] 8.2 Passkey delete: removes credential, rejects invalid credential ID, allows deleting last passkey
- [ ] 8.3 Email change: creates token for new email, rejects duplicate email, rejects same-as-current email
- [ ] 8.4 Account deletion: cascading delete removes user + credentials + tokens, destroys session

### E2E tests (Playwright)
- [ ] 8.5 Auth guard: unauthenticated user visiting `/settings` is redirected to `/auth/login`
- [ ] 8.6 Profile editing: log in, navigate to settings, update display name and bio, verify changes persist after reload, verify public profile reflects changes
- [ ] 8.7 Passkey management: log in, navigate to security section, add passkey (virtual WebAuthn authenticator), verify it appears in list, delete it, verify removed
- [ ] 8.8 Delete last passkey: delete only passkey, verify warning modal appears, confirm deletion, verify magic link login still works
- [ ] 8.9 Email change: initiate email change, follow verification link (dev mode), verify email updated in settings
- [ ] 8.10 Account deletion: click delete, type wrong username (verify blocked), type correct username, confirm, verify redirected to home and session destroyed
- [ ] 8.11 Navigation: verify "Settings" link appears in nav when logged in, not visible when logged out
