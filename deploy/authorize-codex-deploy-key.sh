#!/usr/bin/env bash
set -euo pipefail

install -d -m 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

key='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHEIZM4bgTmSpWG2V3KsjHz0VvCRHqDnfBcfCsFQTwV7 codex-startqa-deploy'
grep -qxF "$key" /root/.ssh/authorized_keys || printf '%s\n' "$key" >> /root/.ssh/authorized_keys

echo "Codex deployment key is ready."
