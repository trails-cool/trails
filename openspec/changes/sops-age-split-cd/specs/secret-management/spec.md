## ADDED Requirements

### Requirement: Encrypted secrets in repository
Production secrets SHALL be stored as a SOPS-encrypted file in the repository, decryptable only with a single age private key.

#### Scenario: Edit secrets
- **WHEN** a developer runs `sops infrastructure/secrets.env`
- **THEN** the file is decrypted in a temporary editor, and re-encrypted on save

#### Scenario: CD decryption
- **WHEN** the CD workflow runs
- **THEN** the encrypted secrets file is decrypted using the AGE_SECRET_KEY GitHub secret and provided to docker-compose as an env file

#### Scenario: Secret audit trail
- **WHEN** a secret is changed
- **THEN** the change appears in git history as a diff of the encrypted file with a commit message describing what changed
