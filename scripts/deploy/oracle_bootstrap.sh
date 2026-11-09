#!/usr/bin/env bash
# One-time setup of an Oracle Cloud Always Free VM (Ubuntu 22.04 or 24.04,
# Ampere A1, ARM) for the Aftershock api and worker. The repository is
# private, so first give the VM a read-only deploy key (docs/DEPLOY.md), then
# from your laptop:
#   scp scripts/deploy/oracle_bootstrap.sh ubuntu@IP: && ssh ubuntu@IP bash oracle_bootstrap.sh https://YOUR-SITE.vercel.app
# See docs/DEPLOY.md for the Oracle console steps that come first.
set -euo pipefail
site="${1:?usage: oracle_bootstrap.sh https://YOUR-SITE.vercel.app}"
site="${site%/}"

echo "== Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

echo "== Firewall: Oracle's Ubuntu images reject new connections except SSH"
# The rules must come before the image's catch-all REJECT, whose position
# varies between images.
for port in 80 443; do
  if ! sudo iptables -C INPUT -m state --state NEW -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
    reject="$(sudo iptables -L INPUT -n --line-numbers | awk '/REJECT/ {print $1; exit}')"
    sudo iptables -I INPUT "${reject:-1}" -m state --state NEW -p tcp --dport "$port" -j ACCEPT
  fi
done
sudo apt-get install -y -q netfilter-persistent >/dev/null && sudo netfilter-persistent save >/dev/null

echo "== Code"
[ -d Aftershock ] || git clone git@github.com:yasher3413/Aftershock.git
cd Aftershock
mkdir -p data

echo "== Settings"
ip="$(curl -fsS https://api.ipify.org)"
if [ ! -f .env ]; then
  cat > .env <<ENV
API_HOST=${ip}.sslip.io
POSTGRES_PASSWORD=$(openssl rand -hex 24)
PUBLIC_BASE_URL=${site}
INDEX_HTML=${site}/app.html
DEMO_MODE=auto
LOG_LEVEL=INFO
# The path prefix Vercel forwards requests under; the same value goes in vercel.json.
ORIGIN_KEY=$(openssl rand -hex 16)
# The /admin page's password.
ADMIN_PASSWORD=$(openssl rand -base64 18)
# Optional: model-written nightly recaps.
OPENAI_API_KEY=
ENV
fi
echo "api host: https://${ip}.sslip.io"

echo "== Build and start (the first build compiles the simulator; allow 10-20 minutes)"
sudo docker compose -f infra/docker-compose.oracle.yml --env-file .env up -d --build
echo
echo "Done. Next, from your laptop: scripts/deploy/push_data.sh ubuntu@${ip}"
origin_key="$(sed -n 's/^ORIGIN_KEY=//p' .env)"
echo "Then on your laptop: scripts/set_api_host.sh ${ip}.sslip.io ${origin_key}, commit vercel.json, and set"
echo "VITE_WS_URL=wss://${ip}.sslip.io/ws/live in the Vercel project."
