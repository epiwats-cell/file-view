#!/usr/bin/env bash
#
# One-command setup for File-View on an Oracle Cloud "Always Free" VM.
# Works on both Oracle Linux (dnf/firewalld) and Ubuntu (apt/ufw).
#
# It will:
#   1. Install Docker Engine + the compose plugin (if missing)
#   2. Open the app port in the OS firewall (firewalld/ufw + iptables)
#   3. Build and start File-View with docker compose
#
# Run it from inside the cloned repo directory:
#   chmod +x deploy/oracle-setup.sh
#   ./deploy/oracle-setup.sh
#
# IMPORTANT: You ALSO have to open the port in the OCI console
# (Networking -> VCN -> Security List -> add an Ingress rule). The OS firewall
# alone is not enough on Oracle Cloud. See deploy/ORACLE.md for details.

set -euo pipefail

APP_PORT="${APP_PORT:-3000}"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!! \033[0m %s\n' "$*"; }

# --- must be run from the repo root (where docker-compose.yml lives) ---
if [[ ! -f docker-compose.yml ]]; then
  echo "docker-compose.yml not found. Run this script from the repo root." >&2
  exit 1
fi

# --- detect package manager ---
if command -v dnf >/dev/null 2>&1; then
  PKG=dnf
elif command -v apt-get >/dev/null 2>&1; then
  PKG=apt
else
  echo "Unsupported distro: need dnf (Oracle Linux) or apt (Ubuntu)." >&2
  exit 1
fi

SUDO=""
if [[ $EUID -ne 0 ]]; then SUDO="sudo"; fi

# --- install Docker if needed ---
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker ($PKG)..."
  if [[ $PKG == dnf ]]; then
    $SUDO dnf install -y dnf-utils
    $SUDO dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    $SUDO dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  else
    $SUDO apt-get update -y
    $SUDO apt-get install -y ca-certificates curl gnupg
    $SUDO install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
    . /etc/os-release
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
      | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null
    $SUDO apt-get update -y
    $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  fi
  $SUDO systemctl enable --now docker
  log "Docker installed."
else
  log "Docker already present: $(docker --version)"
fi

# --- open the firewall (best effort) ---
log "Opening port ${APP_PORT} in the OS firewall..."
if command -v firewall-cmd >/dev/null 2>&1 && $SUDO systemctl is-active --quiet firewalld; then
  $SUDO firewall-cmd --permanent --add-port=${APP_PORT}/tcp || true
  $SUDO firewall-cmd --reload || true
elif command -v ufw >/dev/null 2>&1; then
  $SUDO ufw allow ${APP_PORT}/tcp || true
fi
# Oracle images ship strict iptables rules - add a direct ACCEPT as a fallback.
if command -v iptables >/dev/null 2>&1; then
  $SUDO iptables -I INPUT -p tcp --dport ${APP_PORT} -j ACCEPT 2>/dev/null || true
  $SUDO netfilter-persistent save 2>/dev/null || true
fi

# --- start the app ---
log "Building and starting File-View..."
$SUDO docker compose up -d --build

PUBLIC_IP="$(curl -s --max-time 5 ifconfig.me || echo '<your-vm-public-ip>')"
echo
log "Done! File-View should be reachable at:"
echo "    http://${PUBLIC_IP}:${APP_PORT}"
echo
warn "If it does not load, add an Ingress rule for TCP ${APP_PORT} in the OCI"
warn "console (VCN -> Security List). See deploy/ORACLE.md."
warn "Default login: admin / admin1234  -- change it after first sign in."
