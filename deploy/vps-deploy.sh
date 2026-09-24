#!/bin/sh
# Reference copy of /opt/bsd/deploy.sh on the VPS (the forced command for the GitHub deploy key).
# Keep the two in sync by hand. The VPS copy is what actually runs.
set -e
cd /opt/bsd-src
git fetch --quiet origin main
git reset --hard --quiet origin/main
cd /opt/bsd
docker compose build api web
docker compose up -d

# Keep BSD's Caddy site file in place. The shared Caddy imports /opt/caddy-sites.d/*.caddy,
# so this self-heals if the file is ever removed. Only reload when it actually changed.
if ! cmp -s /opt/bsd-src/deploy/bsd.caddy /opt/caddy-sites.d/bsd.caddy; then
  install -m 644 /opt/bsd-src/deploy/bsd.caddy /opt/caddy-sites.d/bsd.caddy
  docker exec platform-caddy-1 caddy reload --config /etc/caddy/Caddyfile
fi

echo "BSD deploy complete: $(cd /opt/bsd-src && git rev-parse --short HEAD)"
