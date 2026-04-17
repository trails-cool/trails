## Context

The operator is based in Germany. German law requires an Impressum for any online service (TMG §5 / MStV §18) and a GDPR-compliant privacy policy (DSGVO Art. 13/14). Missing Impressum is routinely exploited by Abmahnanwälte — fines and legal costs can reach several thousand euros. The current privacy page is written as a human-readable manifest, not a formal Datenschutzerklärung.

The service is also in early alpha. The operator may reset the database, change core behavior, or break APIs at any time. Users signing up now have no way to know this.

## Goals / Non-Goals

**Goals:**
- Meet the minimum legal requirements to operate from Germany (Impressum, Datenschutzerklärung, ToS)
- Set clear user expectations about the alpha state — database resets, breaking changes
- Require explicit acknowledgement at signup so there is a record of informed consent
- Keep the existing privacy manifest style (readable, honest) while adding the formal GDPR sections

**Non-Goals:**
- Professional legal review — the operator should still have a German IT lawyer review the final text before publishing
- Cookie banner / consent management — trails.cool uses only essential cookies (no tracking, no analytics), so no banner is required under §25 TDDDG
- Age verification or KYC
- ToS-level commitments that would constitute a contract of service (we explicitly disclaim warranties)

## Decisions

### 1. Routes under `/legal/`
**Choice**: `/legal/imprint`, `/legal/privacy`, `/legal/terms` — move the existing `/privacy` route to `/legal/privacy` with a redirect.
**Rationale**: Grouped namespace makes the legal pages easy to find and link from the footer. Redirect preserves existing privacy links.
**Alternative considered**: Keep `/privacy` at the top level — less organized as more legal pages are added.

### 2. Impressum as a plain page with placeholders
**Choice**: The Impressum page is server-rendered from a small config object (operator name, address, email, responsible person). Not i18n'd — Impressum is normally in the language of the operator's country (German), but we'll include an English section below.
**Rationale**: The operator's legal details rarely change. Keeping them in a config file (TypeScript) rather than the database avoids needing a CMS for a static page.
**Alternative considered**: Database-backed operator config — overkill for data that changes once a year at most.

### 3. Signup acknowledgement via checkbox + timestamp
**Choice**: Add a required checkbox on the registration form. On successful registration, store `terms_accepted_at` on the user row. If the Terms are later updated in a material way, we can compare the accepted timestamp and prompt re-acknowledgement.
**Rationale**: A timestamped record of acknowledgement is sufficient for the experimental-status disclaimer. Re-acknowledgement is only needed for material changes.
**Alternative considered**: Store the full ToS version hash — more precise but overkill while the operator can reset everyone's data anyway.

### 4. Alpha banner
**Choice**: A thin banner at the top of the Journal layout, showing "trails.cool is in early development — your data may be reset. See Terms." The banner is dismissible for the browser session (sessionStorage, not cookie). Not shown on the Planner because Planner sessions are already anonymous and ephemeral.
**Rationale**: Persistent, visible signal that users can dismiss. Session-scoped dismissal means returning users still see it occasionally.
**Alternative considered**: One-time dismissal stored in the DB — adds server state for a trivial UX feature.

### 5. Keep Datenschutzerklärung readable
**Choice**: The existing privacy manifest structure (Planner, Journal, Sentry, Email, Third Parties, Security) stays. We add new sections at the top for the GDPR-required info: data controller contact, legal basis for processing each category, data subject rights (Art. 15–22 DSGVO), and right to complain to the Berlin Beauftragte für Datenschutz.
**Rationale**: Keeping the plain-language summary is valuable. The formal sections are additive.

## Risks / Trade-offs

- **Text is not legally reviewed**: The drafted text is a starting point — the operator should have a German IT lawyer review before publishing. → Mitigation: Note this explicitly in the tasks; don't treat the first version as final.
- **Impressum requires real address**: The operator's private address is publicly exposed unless they rent a business address or use a service. → Mitigation: Call this out in the tasks so the operator decides before deploying.
- **Re-acknowledgement flow not built now**: If the Terms change materially, users should re-acknowledge. The initial version doesn't include this. → Mitigation: The `terms_accepted_at` timestamp is captured so the flow can be added later.
- **Banner fatigue**: A persistent banner can be annoying. → Mitigation: Session-scoped dismissal keeps it low-friction.
