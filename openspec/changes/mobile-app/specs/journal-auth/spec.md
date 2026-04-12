## MODIFIED Requirements

### Requirement: OAuth2 PKCE authorization flow
The Journal SHALL support OAuth2 authorization code flow with PKCE for mobile app token exchange, in addition to existing passkey and magic link authentication.

#### Scenario: Authorization endpoint
- **WHEN** a client requests `GET /oauth/authorize` with client_id, redirect_uri, code_challenge, and code_challenge_method
- **THEN** the Journal shows the existing login UI and, upon successful authentication, redirects to the redirect_uri with an authorization code

#### Scenario: Token exchange
- **WHEN** a client sends `POST /oauth/token` with the authorization code, code_verifier, client_id, and redirect_uri
- **THEN** the Journal validates the PKCE challenge, issues an access token and refresh token, and returns them

#### Scenario: Token refresh
- **WHEN** a client sends `POST /oauth/token` with grant_type=refresh_token and a valid refresh token
- **THEN** the Journal issues a new access token and optionally a new refresh token

#### Scenario: Invalid PKCE challenge
- **WHEN** a client sends a code_verifier that does not match the stored code_challenge
- **THEN** the Journal rejects the token exchange with a 400 error

### Requirement: OAuth2 client registration
The Journal SHALL register the mobile app as a trusted first-party OAuth2 client.

#### Scenario: Mobile app client
- **WHEN** the mobile app initiates an OAuth2 flow with client_id `trails-cool-mobile`
- **THEN** the Journal recognizes it as a trusted client and allows the `trailscool://` redirect URI scheme
