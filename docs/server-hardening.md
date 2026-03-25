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

## SSH Hardening

Already in place:
- Key-based auth only (password auth disabled by Hetzner cloud-init)
- Root login via SSH key only

Optional improvements:
- Change SSH port (security through obscurity, mild benefit)
- Add `AllowUsers root` to `/etc/ssh/sshd_config` to restrict SSH users
