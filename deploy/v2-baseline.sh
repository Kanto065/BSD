#!/usr/bin/env bash
# Helper for the v2 database migration on the shared VPS. Read deploy/v2-migration-runbook.md first.
#
# Run from your own machine (Git Bash). It talks to the VPS over SSH with the same key you already use.
# Nothing here runs by itself. Each mode is a separate command you choose to run, in this order:
#
#   bash deploy/v2-baseline.sh check              read only. Versions, row counts, migration history.
#   bash deploy/v2-baseline.sh backup             writes a compressed pg_dump on the VPS.
#   bash deploy/v2-baseline.sh baseline <ref>     builds the API image from <ref> and marks 0_init as applied.
#   ... then merge to main so the normal deploy applies 1_v2_schema ...
#   bash deploy/v2-baseline.sh seed               loads categories, zones and localities (idempotent).
#   bash deploy/v2-baseline.sh verify             read only. Confirms migrations, counts and the API health check.

set -euo pipefail

VPS="root@169.58.119.208"
KEY="${BSD_VPS_KEY:-$HOME/.ssh/vps_fix}"
MODE="${1:-}"
REF="${2:-origin/v2-refresh}"

ssh_vps() { ssh -i "$KEY" -o BatchMode=yes "$VPS" "$@"; }
psql_bsd() { ssh_vps "docker exec bsd-postgres psql -U bsd -d bsd -At -F' ' -c \"$1\""; }

case "$MODE" in
  check)
    echo "== PostgreSQL version"
    ssh_vps "docker exec bsd-postgres postgres --version"
    echo "== Prisma migration history table (none means the baseline has not been done)"
    psql_bsd "select coalesce(to_regclass('public._prisma_migrations')::text, 'none');"
    echo "== Row counts that matter (Business, ContactMessage and BusinessPhoto must all be 0)"
    psql_bsd "select 'Business', count(*) from \\\"Business\\\" union all select 'ContactMessage', count(*) from \\\"ContactMessage\\\" union all select 'BusinessPhoto', count(*) from \\\"BusinessPhoto\\\" union all select 'Category', count(*) from \\\"Category\\\" union all select 'AdminUser', count(*) from \\\"AdminUser\\\";"
    echo "== Containers"
    ssh_vps "docker ps --format '{{.Names}}\t{{.Status}}' | grep -E '^bsd-'"
    ;;

  backup)
    FILE="/root/backups/bsd-pre-v2-$(date +%Y%m%d-%H%M%S).sql.gz"
    ssh_vps "mkdir -p /root/backups && docker exec bsd-postgres pg_dump -U bsd bsd | gzip > $FILE && ls -l $FILE"
    echo "Backup written on the VPS. To restore later, see the runbook."
    ;;

  baseline)
    echo "Building the API image from $REF and marking the 0_init migration as applied."
    ssh_vps "bash -s" -- "$REF" <<'REMOTE'
set -euo pipefail
REF="$1"
HAS=$(docker exec bsd-postgres psql -U bsd -d bsd -At -c "select coalesce(to_regclass('public._prisma_migrations')::text, 'none');")
if [ "$HAS" != "none" ]; then
  echo "The migration history table already exists ($HAS). The baseline was already done, so nothing to do."
  exit 0
fi
for T in Business ContactMessage BusinessPhoto; do
  N=$(docker exec bsd-postgres psql -U bsd -d bsd -At -c "select count(*) from \"$T\";")
  if [ "$N" != "0" ]; then echo "Refusing: \"$T\" has $N rows. The v2 migration needs a backfill first."; exit 1; fi
done
cd /opt/bsd-src
git fetch --quiet origin
git checkout --quiet --detach "$REF"
test -f bsd-api/prisma/migrations/0_init/migration.sql || { echo "0_init not found in $REF"; exit 1; }
cd /opt/bsd
docker compose build api
docker compose run --rm --no-deps api npx prisma migrate resolve --applied 0_init
# Put the source tree back where the normal deploy expects it. deploy.sh resets it to origin/main anyway.
cd /opt/bsd-src
git checkout --quiet --detach origin/main
echo "Baseline done. The running containers were not restarted."
REMOTE
    ;;

  seed)
    ssh_vps "docker exec bsd-api npx tsx prisma/seed.ts"
    ;;

  verify)
    echo "== Migration history"
    psql_bsd "select migration_name, finished_at is not null from _prisma_migrations order by migration_name;"
    echo "== Counts (expect 20 categories, 73 subcategories, 3 zones, 47 localities, 0 businesses)"
    psql_bsd "select 'Category', count(*) from \\\"Category\\\" union all select 'Subcategory', count(*) from \\\"Subcategory\\\" union all select 'CoverageZone', count(*) from \\\"CoverageZone\\\" union all select 'Locality', count(*) from \\\"Locality\\\" union all select 'Business', count(*) from \\\"Business\\\";"
    echo "== Zones"
    psql_bsd "select slug, name, cardinality(\\\"postcodeDistricts\\\") from \\\"CoverageZone\\\" order by \\\"sortOrder\\\";"
    echo "== Prisma status (inside the API container)"
    ssh_vps "docker exec bsd-api npx prisma migrate status" || true
    echo "== Public health check"
    curl -sS -m 20 https://api.bsd.wales/health; echo
    ;;

  *)
    sed -n '2,16p' "$0"
    exit 1
    ;;
esac
