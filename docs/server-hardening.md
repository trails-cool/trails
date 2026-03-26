# Server Hardening

Steps to harden the Hetzner CX21 production server.

## UFW Firewall

```bash
# Install and enable
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Caddy redirect)
ufw allow 443/tcp   # HTTPS
ufw enable
ufw status
```

## Fail2ban (SSH protection)

```bash
# Install
apt install -y fail2ban

# Create config
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600
EOF

# Start
systemctl enable fail2ban
systemctl start fail2ban

# Check status
fail2ban-client status sshd
```

## Email (SMTP)

Transactional emails (magic link login, welcome) require an SMTP server.
Set these env vars on the server (used by docker-compose):

```bash
# SMTP connection URL (any provider: Mailgun, SES, Postfix relay, etc.)
export SMTP_URL="smtp://user:pass@smtp.example.com:587"

# Optional: override sender address (defaults to noreply@trails.cool)
export SMTP_FROM="trails.cool <noreply@trails.cool>"
```

DNS records for deliverability (add to your domain's DNS):
- **SPF**: `v=spf1 include:_spf.your-smtp-provider.com ~all`
- **DKIM**: Provider-specific TXT record for email signing
- **DMARC**: `v=DMARC1; p=quarantine; rua=mailto:dmarc@trails.cool`

In dev mode, emails are logged to console instead of sent (no SMTP needed).

## SSH Hardening

Already in place:
- Key-based auth only (password auth disabled by Hetzner cloud-init)
- Root login via SSH key only

Optional improvements:
- Change SSH port (security through obscurity, mild benefit)
- Add `AllowUsers root` to `/etc/ssh/sshd_config` to restrict SSH users
