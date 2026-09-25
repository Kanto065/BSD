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

# Keep BSD's Caddy site file in place. The shared Caddy imports /opt/caddy-sites.d/*.caddy, so this self-heals if
# the file is ever removed. Caddy is shared with other projects, so a new file is validated by the running Caddy
# before it is used. If it is invalid the previous file is put back and the deploy fails loudly, instead of leaving a
# broken file for the next Caddy restart to trip over.
SITES=/opt/caddy-sites.d
NEW=/opt/bsd-src/deploy/bsd.caddy
if ! cmp -s "$NEW" "$SITES/bsd.caddy"; then
  [ -f "$SITES/bsd.caddy" ] && cp "$SITES/bsd.caddy" /opt/bsd/bsd.caddy.previous
  install -m 644 "$NEW" "$SITES/bsd.caddy"
  if docker exec platform-caddy-1 caddy validate --config /etc/caddy/Caddyfile >/tmp/bsd-caddy-validate.log 2>&1; then
    docker exec platform-caddy-1 caddy reload --config /etc/caddy/Caddyfile
  else
    if [ -f /opt/bsd/bsd.caddy.previous ]; then
      install -m 644 /opt/bsd/bsd.caddy.previous "$SITES/bsd.caddy"
    else
      rm -f "$SITES/bsd.caddy"
    fi
    echo "deploy/bsd.caddy failed validation, the previous version was kept:" >&2
    tail -5 /tmp/bsd-caddy-validate.log >&2
    exit 1
  fi
fi

echo "BSD deploy complete: $(cd /opt/bsd-src && git rev-parse --short HEAD)"
