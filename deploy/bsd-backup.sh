#!/bin/sh
# Nightly BSD backup, run on the VPS by cron (/etc/cron.d/bsd-backup, installed by deploy/install-backup.sh).
#   - database: pg_dump of "bsd", gzip, integrity-checked
#   - photos:   the bsd-uploads bucket, mirrored with BSD's own restricted MinIO user, then archived
# Keeps 14 days. Logs to /var/log/bsd-backup.log. Exits non-zero if anything fails.
#
# These backups live on the same server, so they protect against mistakes (a bad delete, a broken migration), not
# against losing the server. Copy /root/backups/bsd somewhere else from time to time (see the runbook).
set -eu

DEST=/root/backups/bsd
KEEP_DAYS=14
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$DEST/uploads-current"
umask 077

log() { echo "$(date '+%F %T') $*"; }

# --- database
DB="$DEST/db-$STAMP.sql.gz"
docker exec bsd-postgres pg_dump -U bsd --no-owner bsd | gzip > "$DB"
gzip -t "$DB"
TABLES=$(gunzip -c "$DB" | grep -c '^CREATE TABLE' || true)
[ "$TABLES" -ge 10 ] || { log "database dump looks incomplete ($TABLES tables)"; exit 1; }
log "database ok: $DB ($(du -h "$DB" | cut -f1), $TABLES tables)"

# --- photos (bsd-uploads bucket), with the bsd-api user's key from /opt/bsd/.env
SECRET=$(grep '^S3_SECRET_KEY=' /opt/bsd/.env | cut -d= -f2-)
[ -n "$SECRET" ] || { log "S3_SECRET_KEY missing from /opt/bsd/.env"; exit 1; }
docker run --rm --network platform_internal \
  -e MC_HOST_bsd="http://bsd-api:${SECRET}@minio:9000" \
  -v "$DEST/uploads-current:/backup" \
  minio/mc:latest mirror --quiet --overwrite --remove bsd/bsd-uploads /backup >/dev/null
UP="$DEST/uploads-$STAMP.tar"
tar -cf "$UP" -C "$DEST/uploads-current" .
tar -tf "$UP" >/dev/null
log "photos ok: $UP ($(du -h "$UP" | cut -f1), $(find "$DEST/uploads-current" -type f | wc -l) files)"

# --- keep 14 days
find "$DEST" -maxdepth 1 -type f \( -name 'db-*.sql.gz' -o -name 'uploads-*.tar' \) -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/removed old backup /' || true
log "done"
