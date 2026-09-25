#!/usr/bin/env bash
# Installs the nightly BSD backup on the VPS and runs it once to prove it works. Run from your own machine:
#
#   bash deploy/install-backup.sh
#
# It copies deploy/bsd-backup.sh to /opt/bsd/bsd-backup.sh, adds /etc/cron.d/bsd-backup (every night at 03:15,
# server time), and runs one backup now. Safe to run again. To remove: delete /etc/cron.d/bsd-backup on the VPS.
set -euo pipefail
VPS="root@169.58.119.208"
KEY="${BSD_VPS_KEY:-$HOME/.ssh/vps_fix}"
HERE="$(cd "$(dirname "$0")" && pwd)"

scp -q -i "$KEY" -o BatchMode=yes "$HERE/bsd-backup.sh" "$VPS:/opt/bsd/bsd-backup.sh"
ssh -i "$KEY" -o BatchMode=yes "$VPS" 'bash -s' <<'REMOTE'
set -euo pipefail
chmod 700 /opt/bsd/bsd-backup.sh
sed -i 's/\r$//' /opt/bsd/bsd-backup.sh
sh -n /opt/bsd/bsd-backup.sh
cat > /etc/cron.d/bsd-backup <<'CRON'
# BSD nightly backup (database and bsd-uploads photos), see /opt/bsd/bsd-backup.sh
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 3 * * * root /opt/bsd/bsd-backup.sh >> /var/log/bsd-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/bsd-backup
echo "== cron installed: $(grep -v '^#' /etc/cron.d/bsd-backup | tail -1)"
echo "== running one backup now:"
/opt/bsd/bsd-backup.sh
echo "== backups on disk:"
ls -lh /root/backups/bsd | tail -n +2
REMOTE
