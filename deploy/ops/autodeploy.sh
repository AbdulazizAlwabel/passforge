#!/usr/bin/env bash
# Pull-based deploys: every few minutes, if GitHub main moved, rebuild and install it.
# No credentials are stored anywhere — the repository is public and fetched read-only.
set -uo pipefail
REPO=https://github.com/AbdulazizAlwabel/passforge.git
SRC=/opt/nicelydone-src
LOG=/var/log/nicelydone-deploy.log
here=$(dirname "$(readlink -f "$0")")
[ -d "$SRC/.git" ] || git clone -q "$REPO" "$SRC"
cd "$SRC" || exit 1
git fetch -q origin main || exit 0
local_rev=$(git rev-parse HEAD); remote_rev=$(git rev-parse origin/main)
[ "$local_rev" = "$remote_rev" ] && [ -f "$SRC/.deployed" ] && [ "$(cat "$SRC/.deployed")" = "$remote_rev" ] && exit 0
git reset -q --hard origin/main
msg=$(git log -1 --format='%h %s')
{
  echo "=== $(date -u) deploying $msg"
  python3 build.py && bash deploy/install-vm.sh
} >> "$LOG" 2>&1
if [ $? -eq 0 ] && curl -fsS --max-time 15 https://nicelydone.qd.je/api/health | grep -q '"ok":true'; then
  echo "$remote_rev" > "$SRC/.deployed"
  # Tell IndexNow search engines (Bing, Yandex, Seznam, Naver) the pages may have changed.
  python3 - "$SRC" >> "$LOG" 2>&1 <<'PY' || true
import json, sys, urllib.request, xml.etree.ElementTree as ET
src = sys.argv[1]
key = json.load(open(src + "/src/seo.json")).get("indexnow_key")
if key:
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [u.find("s:loc", ns).text for u in ET.parse(src + "/dist/sitemap.xml").getroot().findall("s:url", ns)]
    body = json.dumps({"host": "nicelydone.qd.je", "key": key, "keyLocation": f"https://nicelydone.qd.je/{key}.txt", "urlList": urls}).encode()
    req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body, headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        print("indexnow:", urllib.request.urlopen(req, timeout=20).status, len(urls), "urls")
    except Exception as e:
        print("indexnow failed:", e)
PY
  "$here/notify.sh" "🚀 Deployed to nicelydone.qd.je" "$msg"
else
  "$here/notify.sh" "❌ Deploy failed on nicelydone.qd.je" "$msg — see $LOG"
fi
