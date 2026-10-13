#!/usr/bin/env bash
# Nightly MariaDB dump of the passforge database, kept 14 days (root-only, readable by group opc for off-site pulls).
set -euo pipefail
DIR=/var/backups/nicelydone
install -d -m 750 -o root -g opc "$DIR"
TS=$(date -u +%Y-%m-%dT%H%MZ)
TMP="$DIR/.passforge-$TS.sql.gz.part"
mysqldump --single-transaction --quick --skip-lock-tables passforge | gzip -9 > "$TMP"
gzip -t "$TMP"
chmod 640 "$TMP"; chown root:opc "$TMP"
mv "$TMP" "$DIR/passforge-$TS.sql.gz"
find "$DIR" -name 'passforge-*.sql.gz' -mtime +14 -delete
echo "backup ok: passforge-$TS.sql.gz ($(du -h "$DIR/passforge-$TS.sql.gz" | cut -f1))"
