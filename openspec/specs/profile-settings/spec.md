# profile-settings Specification

## Purpose
The user-facing profile editing surface — display name, bio, and `profile_visibility` — exposed through the Journal's settings page. The locked-account semantics that `profile_visibility` controls live in `public-profiles` and `social-follows`; this spec only covers the editing UX and API.

## Requirements

### Requirement: Profile settings page at `/settings/profile`
The Journal SHALL expose a Profile settings page at `/settings/profile` (one of the four sub-pages of `/settings` — the bare `/settings` URL redirects here). The page SHALL let the signed-in user edit their display name, bio, and profile visibility, and save the changes through `POST /api/settings/profile`. Save SHALL be optimistic via a fetcher; success SHALL be confirmed with a visible "Profile saved." line and the form SHALL re-render with the persisted values.

#### Scenario: Edit display name and bio
- **WHEN** a signed-in user changes the display name and/or bio fields and clicks Save
- **THEN** the API persists the new values on `users.display_name` / `users.bio` and the page renders "Profile saved." and the new values

#### Scenario: Validation error renders inline
- **WHEN** the API rejects the submission (e.g. display name too long)
- **THEN** the form renders the error inline and the values are not persisted

### Requirement: Profile visibility toggle
The Profile settings page SHALL include a `profileVisibility` radio group with `public` and `private` options. New accounts default to `private` (locked-account model). Changing the value and saving SHALL update `users.profile_visibility` and take effect on the next page render across the site (counts, profile-route gating, follow-button state).

#### Scenario: Toggle to private
- **WHEN** a public-profile user selects "private" and saves
- **THEN** `users.profile_visibility` is set to `private`; subsequent visitors to the profile see the locked stub per `public-profiles`; existing accepted follows are unaffected; new follow requests land Pending

#### Scenario: Toggle to public
- **WHEN** a private-profile user selects "public" and saves
- **THEN** `users.profile_visibility` is set to `public`; future incoming follows auto-accept; previously-Pending follows remain Pending until explicitly approved or rejected

#### Scenario: Radio is targeted by name + value, not label text
- **WHEN** end-to-end tests interact with the visibility radio
- **THEN** the test selector is `input[type=radio][name=profileVisibility][value=public|private]`, because the help-text label of one radio mentions the other's word and a label-based selector would collide
