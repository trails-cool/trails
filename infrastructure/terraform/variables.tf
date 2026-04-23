variable "hcloud_token" {
  description = "Hetzner Cloud API token"
  type        = string
  sensitive   = true
}

variable "ssh_public_key" {
  description = "SSH public key for server access"
  type        = string
}

variable "vswitch_id" {
  description = "Hetzner Robot vSwitch ID bridging the flagship to the dedicated BRouter host (see robot.hetzner.com/vswitch)"
  type        = number
}