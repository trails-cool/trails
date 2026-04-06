## Purpose

SOPS-encrypted secrets stored in the repository, split into app and infra files, decryptable with a single age key at deploy time.

## Requirements

### Requirement: Encrypted secrets in repository
Production secrets SHALL be stored as SOPS-encrypted files in the repository, decryptable only with a single age private key. Secrets are split into two files: `secrets.app.env` (application secrets) and `secrets.infra.env` (infrastructure secrets).

#### Scenario: Edit secrets
- **WHEN** a developer runs `sops infrastructure/secrets.app.env` or `sops infrastructure/secrets.infra.env`
- **THEN** the file is decrypted in a temporary editor, and re-encrypted on save

#### Scenario: CD decryption
- **WHEN** the CD workflow runs
- **THEN** both encrypted secrets files are decrypted using the AGE_SECRET_KEY GitHub secret and merged at deploy time as env files for docker-compose

#### Scenario: Secret audit trail
- **WHEN** a secret is changed
- **THEN** the change appears in git history as a diff of the encrypted file with a commit message describing what changed
