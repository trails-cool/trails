terraform {
  required_version = ">= 1.0"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
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
  server_type = "cx22"
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
  EOF
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

output "server_ip" {
  value = hcloud_server.trails.ipv4_address
}
