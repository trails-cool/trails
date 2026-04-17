## Why

trails.cool is operated from Germany, which means German law (TMG, TDDDG, MStV, and GDPR via DSGVO) applies. There is currently no Impressum, no Terms of Service, and the privacy manifest isn't a full GDPR-compliant Datenschutzerklärung — this exposes the operator to legal risk (Abmahnungen are common for missing Impressum in Germany).

Separately, the service is in active early development. Users signing up today may find their accounts wiped if the operator decides to reset the database, or they may encounter breaking changes to the UI, URLs, or federation behavior. Current users have no signal that this is experimental, which sets wrong expectations and creates another liability surface.

## What Changes

- Add an **Impressum** page at `/legal/imprint` with operator name, address, email, and responsible person per §5 TMG / §18 MStV
- Expand the existing privacy manifest into a full **Datenschutzerklärung** at `/legal/privacy` — keep the human-readable summary but add the GDPR-required sections (legal basis, data subject rights, controller contact, right to complain)
- Add a **Terms of Service** page at `/legal/terms` with:
  - Alpha / experimental status disclaimer (service is untested, under active development)
  - No warranty / no SLA / limitation of liability (within German consumer-protection limits)
  - Explicit statement that the database may be wiped without notice
  - User responsibility to export their own data (linking to existing export)
  - Acceptable use (no illegal content, no abuse)
- Require **acknowledgement at signup**: a checkbox on the registration form confirming the user has read the Terms and understands the alpha status. Form cannot submit without it.
- Add a persistent **alpha banner** on the Journal (thin, dismissible for the session) linking to the Terms with the line "trails.cool is in early development — data may be reset"
- Add **footer links** to Impressum / Privacy / Terms on both apps (Journal and Planner)

## Capabilities

### New Capabilities
- `legal-disclaimers`: Impressum page, Terms of Service with alpha disclaimer, full Datenschutzerklärung, signup acknowledgement flow, alpha banner, and footer links

### Modified Capabilities
- `journal-auth`: Registration SHALL require explicit acknowledgement of the Terms of Service before account creation

## Impact

- **Legal risk reduction**: Closes the Impressum gap that triggers Abmahnungen in Germany
- **User expectations**: Clear alpha signal reduces complaints if the DB is reset
- **Code**: New routes in the Journal (`/legal/imprint`, `/legal/terms`, expanded `/legal/privacy`), footer component updates, registration form change
- **i18n**: All legal copy needs EN + DE translations (DE is the authoritative version for German consumers)
- **Database**: Add `terms_accepted_at` timestamp to the `users` table to record acknowledgement
- **Operator info**: The operator's real name and address will be in the Impressum — this is a legal requirement and cannot be omitted
