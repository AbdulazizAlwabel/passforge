#!/usr/bin/env bash
# Every 5 minutes: is the site up (through Caddy + TLS) and is the certificate fresh?
# Alerts once on failure (after 2 consecutive misses) and once on recovery.
set -u
URL=${MONITOR_URL:-https://nicelydone.qd.je/api/health}
STATE=/var/lib/nicelydone-monitor; mkdir -p "$STATE"
here=$(dirname "$(readlink -f "$0")")
fails=$(cat "$STATE/fails" 2>/dev/null || echo 0)
if curl -fsS --max-time 15 "$URL" | grep -q '"ok":true'; then
  if [ "$fails" -ge 2 ]; then "$here/notify.sh" "✅ nicelydone.qd.je is back up" "Health check passing again at $(date -u '+%H:%M UTC')."; fi
  echo 0 > "$STATE/fails"
else
  fails=$((fails + 1)); echo "$fails" > "$STATE/fails"
  if [ "$fails" -eq 2 ]; then "$here/notify.sh" "🚨 nicelydone.qd.je is DOWN" "Health check failed twice in a row ($URL). Check: systemctl status nicelydone caddy mariadb"; fi
fi
# Certificate expiry (once a day is enough; Caddy renews ~30 days early)
if [ ! -f "$STATE/cert-checked" ] || [ -n "$(find "$STATE/cert-checked" -mmin +1440)" ]; then
  touch "$STATE/cert-checked"
  end=$(echo | timeout 10 openssl s_client -connect 127.0.0.1:443 -servername nicelydone.qd.je 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [ -n "$end" ]; then
    days=$(( ($(date -d "$end" +%s) - $(date +%s)) / 86400 ))
    [ "$days" -lt 14 ] && "$here/notify.sh" "⚠️ nicelydone.qd.je certificate expires in $days days" "Caddy should renew automatically — check: journalctl -u caddy"
  fi
fi
exit 0
