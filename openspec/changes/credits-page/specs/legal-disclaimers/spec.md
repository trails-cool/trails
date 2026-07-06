## MODIFIED Requirements

### Requirement: Footer legal links
Both the Journal and Planner SHALL render a footer with links to Impressum, Datenschutzerklärung, Terms of Service, Credits, and the source repository.

#### Scenario: Footer on Journal
- **WHEN** a user views any Journal page
- **THEN** the footer contains links labeled "Impressum", "Privacy", and "Terms" pointing to the respective `/legal/*` pages, a "Credits" link pointing to `/about/credits`, plus a link to the source repository

#### Scenario: Footer on Planner
- **WHEN** a user views any Planner page
- **THEN** the footer contains the same legal and credits links, pointing at absolute URLs on the Journal instance (since the Planner is stateless and these pages live on the Journal), plus a link to the source repository
