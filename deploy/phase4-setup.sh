#!/usr/bin/env bash
# One-time VPS setup for Phase 4 (listing submissions with photo uploads). Run it from your own machine in Git Bash:
#
#   bash deploy/phase4-setup.sh check     read only: what exists already
#   bash deploy/phase4-setup.sh apply     does the setup below, then verifies it
#
# What "apply" does, all on the VPS:
#   1. On the restaurant platform's MinIO (container platform-minio-1), creates bucket "bsd-uploads". The platform's
#      own bucket "uploads" is never touched. The MinIO root login is read inside that container from its own
#      environment and never printed or copied out.
#   2. Lets anyone read objects under bsd-uploads/public/ (that is how bsd.wales/uploads/... serves photos), but
#      never list the bucket.
#   3. Creates MinIO user "bsd-api" whose policy reaches only the bsd-uploads bucket, with a new random secret.
#   4. Writes S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY and S3_SECRET_KEY into /opt/bsd/.env (backed up first).
#   5. Adds API_URL=http://bsd-api:4000 to the web service in /opt/bsd/docker-compose.yml (backed up first), so the
#      website's server talks to the API over the Docker network.
#   6. Installs the updated /opt/bsd/deploy.sh (validates bsd.caddy before reloading the shared Caddy).
#   7. Proves it: bsd-api can write and read its bucket, anonymous visitors can read public/ but cannot list, and
#      bsd-api cannot see the platform's "uploads" bucket.
# Nothing is restarted. The next deploy (merging to main) picks the changes up.
#
# "--" is passed to mc before its arguments because a password may begin with "-" (the platform's does).
# Re-running "apply" is safe. It rotates the bsd-api secret and rewrites the same .env lines.

set -euo pipefail

VPS="root@169.58.119.208"
KEY="${BSD_VPS_KEY:-$HOME/.ssh/vps_fix}"
HERE="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:-}"

ssh_vps() { ssh -i "$KEY" -o BatchMode=yes "$VPS" "$@"; }

case "$MODE" in
  check)
    ssh_vps 'bash -s' <<'REMOTE'
set -u
echo "== MinIO container and mc:"; docker ps --format '{{.Names}} {{.Status}}' | grep '^platform-minio-1' || echo "platform-minio-1 NOT running"
docker exec platform-minio-1 sh -c 'command -v mc >/dev/null && echo "mc present"'
echo "== buckets (names only):"
docker exec platform-minio-1 sh -c 'mc alias set -- local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1 && mc ls local | while read -r _d _t _s _u name; do echo "$name"; done; mc alias remove local >/dev/null 2>&1 || true'
echo "== S3 keys already in /opt/bsd/.env (names only):"; grep -o '^S3_[A-Z_]*' /opt/bsd/.env || echo "(none)"
echo "== web API_URL in compose:"; grep -n 'API_URL' /opt/bsd/docker-compose.yml || true
echo "== deploy.sh validates bsd.caddy:"; grep -c 'caddy validate' /opt/bsd/deploy.sh || true
REMOTE
    ;;

  apply)
    test -f "$HERE/vps-deploy.sh" || { echo "deploy/vps-deploy.sh not found next to this script"; exit 1; }
    ssh_vps 'bash -s' <<'REMOTE'
set -euo pipefail
docker ps --format '{{.Names}}' | grep -qx platform-minio-1 || { echo "platform-minio-1 is not running"; exit 1; }
docker exec platform-minio-1 sh -c 'command -v mc >/dev/null' || { echo "mc is not available in platform-minio-1"; exit 1; }

STAMP=$(date +%Y%m%d-%H%M%S)
cp /opt/bsd/.env "/opt/bsd/.env.bak-$STAMP"
cp /opt/bsd/docker-compose.yml "/opt/bsd/docker-compose.yml.bak-$STAMP"
# Every command here reads its whole input, so nothing is cut short (with pipefail, a "tr </dev/urandom | head" pipe
# ends in SIGPIPE and silently stops the script).
SECRET=$(head -c 45 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')
[ "${#SECRET}" -ge 40 ] || { echo "could not generate a secret"; exit 1; }

echo "== configuring MinIO (bucket bsd-uploads, user bsd-api)"
docker exec -i -e BSD_SECRET="$SECRET" platform-minio-1 sh -s <<'IN_MINIO'
set -eu
mc alias set -- local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
trap 'mc alias remove local >/dev/null 2>&1 || true; rm -f /tmp/bsd-anon.json /tmp/bsd-rw.json' EXIT
mc mb --ignore-existing local/bsd-uploads
cat > /tmp/bsd-anon.json <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":["*"]},"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::bsd-uploads/public/*"]}]}
JSON
mc anonymous set-json /tmp/bsd-anon.json local/bsd-uploads
cat > /tmp/bsd-rw.json <<'JSON'
{"Version":"2012-10-17","Statement":[
 {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::bsd-uploads/*"]},
 {"Effect":"Allow","Action":["s3:ListBucket","s3:GetBucketLocation"],"Resource":["arn:aws:s3:::bsd-uploads"]}]}
JSON
mc admin policy create local bsd-uploads-rw /tmp/bsd-rw.json >/dev/null
mc admin user add local bsd-api "$BSD_SECRET" >/dev/null
mc admin policy attach local bsd-uploads-rw --user bsd-api >/dev/null 2>&1 || true
echo "bucket, public-read policy for public/, and user bsd-api are in place"
IN_MINIO

echo "== writing S3 settings to /opt/bsd/.env"
sed -i '/^S3_/d' /opt/bsd/.env
{
  echo "S3_ENDPOINT=http://minio:9000"
  echo "S3_BUCKET=bsd-uploads"
  echo "S3_REGION=us-east-1"
  echo "S3_ACCESS_KEY=bsd-api"
  echo "S3_SECRET_KEY=$SECRET"
} >> /opt/bsd/.env
chmod 600 /opt/bsd/.env

echo "== web service talks to the API over the Docker network"
if ! grep -q 'API_URL: http://bsd-api:4000' /opt/bsd/docker-compose.yml; then
  sed -i 's|^\(\s*\)NEXT_PUBLIC_API_URL: https://api.bsd.wales$|&\n\1API_URL: http://bsd-api:4000|' /opt/bsd/docker-compose.yml
fi
grep -q 'API_URL: http://bsd-api:4000' /opt/bsd/docker-compose.yml || { echo "could not add API_URL to the compose file"; exit 1; }
docker compose -f /opt/bsd/docker-compose.yml config -q && echo "compose file is valid"

echo "== verifying isolation"
docker exec -i -e BSD_SECRET="$SECRET" platform-minio-1 sh -s <<'IN_MINIO'
set -u
mc alias set -- bsdcheck http://localhost:9000 bsd-api "$BSD_SECRET" >/dev/null
trap 'mc alias remove bsdcheck >/dev/null 2>&1 || true' EXIT
echo ok | mc pipe bsdcheck/bsd-uploads/public/_setup-check.txt >/dev/null && echo "PASS bsd-api can write its bucket" || echo "FAIL bsd-api cannot write"
if mc ls bsdcheck/uploads >/dev/null 2>&1; then echo "FAIL bsd-api can see the platform bucket"; else echo "PASS bsd-api cannot see the platform bucket"; fi
IN_MINIO
ANON=$(docker exec platform-caddy-1 sh -c 'wget -qO- http://minio:9000/bsd-uploads/public/_setup-check.txt 2>/dev/null' || true)
[ "$ANON" = "ok" ] && echo "PASS anyone can read bsd-uploads/public/" || echo "FAIL anonymous read of public/ (got: $ANON)"
if docker exec platform-caddy-1 sh -c 'wget -qO- "http://minio:9000/bsd-uploads/?list-type=2" >/dev/null 2>&1'; then
  echo "FAIL the bucket can be listed anonymously"
else
  echo "PASS the bucket cannot be listed anonymously"
fi
# The check file is removed only now, after the anonymous read above has used it.
docker exec -i -e BSD_SECRET="$SECRET" platform-minio-1 sh -c 'mc alias set -- bsdcheck http://localhost:9000 bsd-api "$BSD_SECRET" >/dev/null 2>&1; mc rm bsdcheck/bsd-uploads/public/_setup-check.txt >/dev/null 2>&1; mc alias remove bsdcheck >/dev/null 2>&1; true'
REMOTE
    echo "== installing the updated /opt/bsd/deploy.sh"
    ssh_vps 'cp /opt/bsd/deploy.sh /opt/bsd/deploy.sh.bak-phase4'
    scp -q -i "$KEY" -o BatchMode=yes "$HERE/vps-deploy.sh" "$VPS:/opt/bsd/deploy.sh"
    ssh_vps 'chmod 755 /opt/bsd/deploy.sh && sh -n /opt/bsd/deploy.sh && echo "deploy.sh installed (previous copy at /opt/bsd/deploy.sh.bak-phase4)"'
    echo "Done. Nothing was restarted. Merge to main to deploy."
    ;;

  *)
    sed -n '2,26p' "$0"
    exit 1
    ;;
esac
