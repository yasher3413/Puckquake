#!/usr/bin/env bash
# Write vercel.json for an api host and the VM's ORIGIN_KEY, for example:
#   scripts/set_api_host.sh 129.146.10.20.sslip.io 3f9c...
# Vercel rewrites cannot read environment variables, so both are filled in.
# The key keeps callers from reaching the api without going through Vercel,
# so vercel.json must stay out of public view (the repository is private).
set -euo pipefail
cd "$(dirname "$0")/.."
host="${1:?usage: scripts/set_api_host.sh API_HOST ORIGIN_KEY}"
key="${2:?usage: scripts/set_api_host.sh API_HOST ORIGIN_KEY (ORIGIN_KEY is in the .env on the VM)}"
sed -e "s/__API_HOST__/${host}/g" -e "s/__ORIGIN_KEY__/${key}/g" vercel.template.json > vercel.json
echo "wrote vercel.json for ${host}"
echo "In Vercel, set VITE_WS_URL=wss://${host}/ws/live for the build."
