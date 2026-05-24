## Purpose

SOPS-encrypted secrets stored in the repository, split into app and infra files, decryptable with a single age key at deploy time.

## Requirements

### Requirement: Encrypted secrets in repository
Production secrets SHALL be stored as SOPS-encrypted files in the repository, decryptable only with a single age private key. Secrets are split into two files: `secrets.app.env` (application secrets) and `secrets.infra.env` (infrastructure secrets).

#### Scenario: Edit secrets
- **WHEN** a developer runs `sops infrastructure/secrets.app.env` or `sops infrastructure/secrets.infra.env`
- **THEN** the file is decrypted in a temporary editor, and re-encrypted on save

#### Scenario: App deploy decryption
- **WHEN** `cd-apps.yml` runs
- **THEN** only `secrets.app.env` is decrypted using `AGE_SECRET_KEY` and injected into the Journal and Planner containers

#### Scenario: Infra deploy decryption
- **WHEN** `cd-infra.yml` runs
- **THEN** both `secrets.app.env` and `secrets.infra.env` are decrypted and merged for infrastructure services

#### Scenario: Secret audit trail
- **WHEN** a secret is changed
- **THEN** the change appears in git history as a diff of the encrypted file with a commit message describing what changed
