terraform {
  required_version = ">= 1.0"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.60"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

resource "hcloud_ssh_key" "deploy" {
  name       = "trails-cool-deploy"
  public_key = var.ssh_public_key
}

resource "hcloud_server" "trails" {
  name        = "trails-cool"
  server_type = "cx23"
  image       = "ubuntu-24.04"
  location    = "fsn1"
  ssh_keys    = [hcloud_ssh_key.deploy.id]

  labels = {
    project = "trails-cool"
  }

  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail

    # Install Docker
    curl -fsSL https://get.docker.com | sh

    # Install Docker Compose plugin
    apt-get install -y docker-compose-plugin

    # Create app directory
    mkdir -p /opt/trails-cool

    # Harden SSH
    cat > /etc/ssh/sshd_config.d/99-hardening.conf <<'SSHD'
    PasswordAuthentication no
    X11Forwarding no
    AllowTcpForwarding no
    AllowAgentForwarding no
    MaxAuthTries 3
    ClientAliveInterval 300
    ClientAliveCountMax 2
    SSHD
    systemctl reload ssh
  EOF

  # Hetzner Cloud provider's user_data hash algorithm changed in 1.45+,
  # causing spurious replacement diffs on every plan even when the script
  # is unchanged. user_data only runs on first boot anyway — changes after
  # provisioning have no effect — so we pin the attribute to ignore_changes.
  lifecycle {
    ignore_changes = [user_data]
  }
}

resource "hcloud_firewall" "trails" {
  name = "trails-cool"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_firewall_attachment" "trails" {
  firewall_id = hcloud_firewall.trails.id
  server_ids  = [hcloud_server.trails.id]
}

# Private network bridging the flagship (Hetzner Cloud) to the dedicated
# BRouter host (Hetzner Robot) via vSwitch. Both sides must be in the same
# location (fsn1 / eu-central).
#
# Hetzner requires Cloud servers to attach to a regular "cloud" subnet;
# the "vswitch" subnet is VLAN-only and cannot host Cloud NICs. The two
# subnets live side by side in the same network and Hetzner routes between
# them automatically.
#
#   10.0.0.0/16    — overall private network
#   10.0.0.1       — network gateway (reserved by Hetzner; not usable)
#   10.0.0.0/24    — cloud subnet (hosts Cloud server NICs)
#   10.0.0.2       — flagship (assigned below)
#   10.0.1.0/24    — vSwitch subnet (bridged to Robot VLAN)
#   10.0.1.10      — dedicated BRouter host (configured on the Robot side
#                    as a VLAN sub-interface, not managed by Terraform)

resource "hcloud_network" "private" {
  name     = "trails-cool"
  ip_range = "10.0.0.0/16"

  labels = {
    project = "trails-cool"
  }
}

resource "hcloud_network_subnet" "cloud" {
  network_id   = hcloud_network.private.id
  type         = "cloud"
  network_zone = "eu-central"
  ip_range     = "10.0.0.0/24"
}

resource "hcloud_network_subnet" "vswitch" {
  network_id   = hcloud_network.private.id
  type         = "vswitch"
  network_zone = "eu-central"
  ip_range     = "10.0.1.0/24"
  vswitch_id   = var.vswitch_id
}

resource "hcloud_server_network" "trails" {
  server_id  = hcloud_server.trails.id
  network_id = hcloud_network.private.id
  ip         = "10.0.0.2"

  depends_on = [hcloud_network_subnet.cloud]
}

# Reverse DNS

resource "hcloud_rdns" "trails_ipv4" {
  server_id  = hcloud_server.trails.id
  ip_address = hcloud_server.trails.ipv4_address
  dns_ptr    = "trails.cool"
}

resource "hcloud_rdns" "trails_ipv6" {
  server_id  = hcloud_server.trails.id
  ip_address = hcloud_server.trails.ipv6_address
  dns_ptr    = "trails.cool"
}

# DNS

resource "hcloud_zone_rrset" "root_a" {
  zone = "trails.cool"
  name = "@"
  type = "A"
  ttl  = 300
  records = [{ value = hcloud_server.trails.ipv4_address }]
}

resource "hcloud_zone_rrset" "root_aaaa" {
  zone = "trails.cool"
  name = "@"
  type = "AAAA"
  ttl  = 300
  records = [{ value = hcloud_server.trails.ipv6_address }]
}

resource "hcloud_zone_rrset" "planner_a" {
  zone = "trails.cool"
  name = "planner"
  type = "A"
  ttl  = 300
  records = [{ value = hcloud_server.trails.ipv4_address }]
}

resource "hcloud_zone_rrset" "planner_aaaa" {
  zone = "trails.cool"
  name = "planner"
  type = "AAAA"
  ttl  = 300
  records = [{ value = hcloud_server.trails.ipv6_address }]
}

# Internal wildcard — all *.internal.trails.cool resolves to the server.
# Caddy handles routing per-subdomain. No individual DNS entries needed
# for internal services (Grafana, Prometheus, etc.)
resource "hcloud_zone_rrset" "internal_wildcard_a" {
  zone = "trails.cool"
  name = "*.internal"
  type = "A"
  ttl  = 300
  records = [{ value = hcloud_server.trails.ipv4_address }]
}

resource "hcloud_zone_rrset" "internal_wildcard_aaaa" {
  zone = "trails.cool"
  name = "*.internal"
  type = "AAAA"
  ttl  = 300
  records = [{ value = hcloud_server.trails.ipv6_address }]
}

resource "hcloud_zone_rrset" "www_cname" {
  zone = "trails.cool"
  name = "www"
  type = "CNAME"
  ttl  = 300
  records = [{ value = "trails.cool." }]
}

# Fastmail Email

resource "hcloud_zone_rrset" "mx_root" {
  zone = "trails.cool"
  name = "@"
  type = "MX"
  ttl  = 3600
  records = [
    { value = "10 in1-smtp.messagingengine.com." },
    { value = "20 in2-smtp.messagingengine.com." },
  ]
}

resource "hcloud_zone_rrset" "mx_wildcard" {
  zone = "trails.cool"
  name = "*"
  type = "MX"
  ttl  = 3600
  records = [
    { value = "10 in1-smtp.messagingengine.com." },
    { value = "20 in2-smtp.messagingengine.com." },
  ]
}

resource "hcloud_zone_rrset" "mx_mail" {
  zone = "trails.cool"
  name = "mail"
  type = "MX"
  ttl  = 3600
  records = [
    { value = "10 in1-smtp.messagingengine.com." },
    { value = "20 in2-smtp.messagingengine.com." },
  ]
}

resource "hcloud_zone_rrset" "mail_a" {
  zone = "trails.cool"
  name = "mail"
  type = "A"
  ttl  = 3600
  records = [{ value = "103.168.172.65" }]
}

resource "hcloud_zone_rrset" "spf" {
  zone = "trails.cool"
  name = "@"
  type = "TXT"
  ttl  = 3600
  records = [{ value = "\"v=spf1 include:spf.messagingengine.com ?all\"" }]
}

resource "hcloud_zone_rrset" "dmarc" {
  zone = "trails.cool"
  name = "_dmarc"
  type = "TXT"
  ttl  = 3600
  records = [{ value = "\"v=DMARC1; p=none;\"" }]
}

resource "hcloud_zone_rrset" "dkim_fm1" {
  zone = "trails.cool"
  name = "fm1._domainkey"
  type = "CNAME"
  ttl  = 3600
  records = [{ value = "fm1.trails.cool.dkim.fmhosted.com." }]
}

resource "hcloud_zone_rrset" "dkim_fm2" {
  zone = "trails.cool"
  name = "fm2._domainkey"
  type = "CNAME"
  ttl  = 3600
  records = [{ value = "fm2.trails.cool.dkim.fmhosted.com." }]
}

resource "hcloud_zone_rrset" "dkim_fm3" {
  zone = "trails.cool"
  name = "fm3._domainkey"
  type = "CNAME"
  ttl  = 3600
  records = [{ value = "fm3.trails.cool.dkim.fmhosted.com." }]
}

resource "hcloud_zone_rrset" "dkim_mesmtp" {
  zone = "trails.cool"
  name = "mesmtp._domainkey"
  type = "CNAME"
  ttl  = 3600
  records = [{ value = "mesmtp.trails.cool.dkim.fmhosted.com." }]
}

resource "hcloud_zone_rrset" "srv_autodiscover" {
  zone = "trails.cool"
  name = "_autodiscover._tcp"
  type = "SRV"
  ttl  = 3600
  records = [{ value = "0 1 443 autodiscover.fastmail.com." }]
}

resource "hcloud_zone_rrset" "srv_caldav" {
  zone = "trails.cool"
  name = "_caldav._tcp"
  type = "SRV"
  ttl  = 3600
  records = [{ value = "0 0 0 ." }]
}

resource "hcloud_zone_rrset" "srv_caldavs" {
  zone = "trails.cool"
  name = "_caldavs._tcp"
  type = "SRV"
  ttl  = 3600
  records = [{ value = "0 1 443 d5979255.caldav.fastmail.com." }]
}

resource "hcloud_zone_rrset" "srv_carddav" {
  zone = "trails.cool"
  name = "_carddav._tcp"
  type = "SRV"
  ttl  = 3600
  records = [{ value = "0 0 0 ." }]
}

resource "hcloud_zone_rrset" "srv_carddavs" {
  zone = "trails.cool"
  name = "_carddavs._tcp"
  type = "SRV"
  ttl  = 3600
  records = [{ value = "0 1 443 d5979255.carddav.fastmail.com." }]
}

resource "hcloud_zone_rrset" "srv_imap" {
  zone = "trails.cool"
  name = "_imap._tcp"
  type = "SRV"
  ttl  = 3600
  records = [{ value = "0 0 0 ." }]
}

resource "hcloud_zone_rrset" "srv_imaps" {
  zone = "trails.cool"
  name = "_imaps._tcp"
  type = "SRV"
  ttl  = 3600
  records = [{ value = "0 1 993 imap.fastmail.com." }]
}

resource "hcloud_zone_rrset" "srv_jmap" {
  zone = "trails.cool"
  name = "_jmap._tcp"
  type = "SRV"
  ttl  = 3600
  records = [{ value = "0 1 443 api.fastmail.com." }]
}

resource "hcloud_zone_rrset" "srv_pop3" {
  zone = "trails.cool"
  name = "_pop3._tcp"
  type = "SRV"
  ttl  = 3600
  records = [{ value = "0 0 0 ." }]
}

resource "hcloud_zone_rrset" "srv_pop3s" {
  zone = "trails.cool"
  name = "_pop3s._tcp"
  type = "SRV"
  ttl  = 3600
  records = [{ value = "10 1 995 pop.fastmail.com." }]
}

resource "hcloud_zone_rrset" "srv_submission" {
  zone = "trails.cool"
  name = "_submission._tcp"
  type = "SRV"
  ttl  = 3600
  records = [{ value = "0 0 0 ." }]
}

resource "hcloud_zone_rrset" "srv_submissions" {
  zone = "trails.cool"
  name = "_submissions._tcp"
  type = "SRV"
  ttl  = 3600
  records = [{ value = "0 1 465 smtp.fastmail.com." }]
}

# Outputs

output "server_ip" {
  value = hcloud_server.trails.ipv4_address
}

output "domain" {
  value = "trails.cool"
}

output "planner_domain" {
  value = "planner.trails.cool"
}

output "flagship_private_ip" {
  value       = hcloud_server_network.trails.ip
  description = "Private IP of the flagship on the vSwitch network (reachable from the dedicated BRouter host)"
}
