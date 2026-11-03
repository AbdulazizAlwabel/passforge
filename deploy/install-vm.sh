#!/usr/bin/env bash
# Idempotent installer for Oracle Linux 9 (run as a sudoer from the uploaded bundle dir).
# Installs: nicelydone (Node API + static site) on :3080, MariaDB, Caddy (HTTPS) on :80/:443.
set -euo pipefail
BUNDLE=$(cd "$(dirname "$0")/.." && pwd)
APP=/opt/nicelydone
CADDY_VER=2.11.7

echo "== users"
id nicelydone &>/dev/null || sudo useradd --system --home-dir $APP --shell /sbin/nologin nicelydone
id caddy &>/dev/null || sudo useradd --system --home-dir /var/lib/caddy --create-home --shell /sbin/nologin caddy

echo "== app files"
sudo mkdir -p $APP
sudo rsync -a --delete --exclude node_modules --exclude .env "$BUNDLE/dist/" $APP/dist/
sudo rsync -a --exclude node_modules --exclude .env "$BUNDLE/server/" $APP/server/
sudo chown -R root:nicelydone $APP && sudo chmod -R g+rX,o-rwx $APP
sudo bash -c "cd $APP/server && HOME=/root /usr/bin/npm ci --omit=dev --no-audit --no-fund --loglevel=error"
sudo chown -R root:nicelydone $APP/server/node_modules && sudo chmod -R g+rX,o-rwx $APP/server/node_modules

echo "== mariadb"
sudo systemctl enable --now mariadb
if ! sudo test -f $APP/server/.env; then
  DBPW=$(openssl rand -hex 24); JWT=$(openssl rand -hex 48)
  sudo mysql -e "CREATE DATABASE IF NOT EXISTS passforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS 'passforge_app'@'localhost' IDENTIFIED BY '$DBPW';
    ALTER USER 'passforge_app'@'localhost' IDENTIFIED BY '$DBPW';
    GRANT SELECT, INSERT, UPDATE, DELETE ON passforge.* TO 'passforge_app'@'localhost';
    CREATE USER IF NOT EXISTS 'passforge_app'@'127.0.0.1' IDENTIFIED BY '$DBPW';
    ALTER USER 'passforge_app'@'127.0.0.1' IDENTIFIED BY '$DBPW';
    GRANT SELECT, INSERT, UPDATE, DELETE ON passforge.* TO 'passforge_app'@'127.0.0.1'; FLUSH PRIVILEGES;"
  sudo mysql passforge < "$BUNDLE/server/schema.sql"
  sed -e "s/^JWT_SECRET=.*/JWT_SECRET=$JWT/" -e "s/^DB_PASSWORD=.*/DB_PASSWORD=$DBPW/" \
      -e "s|^STATIC_DIR=.*|STATIC_DIR=$APP/dist|" -e "s/^PORT=.*/PORT=3080/" \
      "$BUNDLE/server/.env.example" | sudo tee $APP/server/.env >/dev/null
  sudo chown root:nicelydone $APP/server/.env && sudo chmod 640 $APP/server/.env
  echo "   created database + .env (SMTP still to be filled in)"
fi
# Schema migrations (idempotent: CREATE TABLE IF NOT EXISTS …)
for m in "$BUNDLE"/server/migrations/*.sql; do sudo mysql passforge < "$m"; done
# Secrets added in later versions (never overwrite existing values)
if ! sudo grep -q '^TOTP_ENC_KEY=.\{64\}' $APP/server/.env; then
  sudo sed -i '/^TOTP_ENC_KEY=/d' $APP/server/.env
  echo "TOTP_ENC_KEY=$(openssl rand -hex 32)" | sudo tee -a $APP/server/.env >/dev/null
fi
# MariaDB only on localhost
if ! grep -qs '^bind-address' /etc/my.cnf.d/nicelydone.cnf; then
  printf '[mysqld]\nbind-address=127.0.0.1\nskip-name-resolve\n' | sudo tee /etc/my.cnf.d/nicelydone.cnf >/dev/null
  sudo systemctl restart mariadb
fi

echo "== caddy $CADDY_VER"
if ! /usr/local/bin/caddy version 2>/dev/null | grep -q "v$CADDY_VER"; then
  T=$(mktemp -d)
  curl -fsSL -o $T/c.tgz "https://github.com/caddyserver/caddy/releases/download/v$CADDY_VER/caddy_${CADDY_VER}_linux_arm64.tar.gz"
  curl -fsSL -o $T/sums "https://github.com/caddyserver/caddy/releases/download/v$CADDY_VER/caddy_${CADDY_VER}_checksums.txt"
  EXPECT=$(grep "_linux_arm64.tar.gz$" $T/sums | awk '{print $1}')
  echo "$EXPECT  $T/c.tgz" | sha512sum -c --quiet -
  tar -xzf $T/c.tgz -C $T caddy
  sudo install -m 755 $T/caddy /usr/local/bin/caddy
  CADDY_UPGRADED=1
  sudo restorecon -v /usr/local/bin/caddy || true
  rm -rf $T
fi
sudo mkdir -p /etc/caddy /etc/caddy/backups
# Other sites on this VM (Daftar, the desktop relay) are separate files in
# sites.d, imported by deploy/Caddyfile; this script never touches them.
sudo install -d -m 755 /etc/caddy/sites.d
# Certificate contact email: $ACME_EMAIL, or keep the one already configured on this host.
ACME_EMAIL=${ACME_EMAIL:-$(sudo awk '/^\temail /{print $2; exit}' /etc/caddy/Caddyfile 2>/dev/null || true)}
[ -n "$ACME_EMAIL" ] || { echo "Set ACME_EMAIL=you@example.com (needed for ZeroSSL certificates)"; exit 1; }
# New Caddyfile: validate it (with everything it imports) before it replaces
# the live one, keep a dated backup of the old one, and reload, not restart.
NEW_CADDYFILE=/etc/caddy/Caddyfile.new
sed "s|{\$ACME_EMAIL}|$ACME_EMAIL|" "$BUNDLE/deploy/Caddyfile" | sudo tee "$NEW_CADDYFILE" >/dev/null
# As the caddy user, so an imported file it cannot read fails here, not live.
if ! sudo -u caddy /usr/local/bin/caddy validate --config "$NEW_CADDYFILE" --adapter caddyfile >/tmp/caddy-validate.log 2>&1; then
  echo "!! the new Caddyfile does not validate; the live one is unchanged:"; tail -20 /tmp/caddy-validate.log
  sudo rm -f "$NEW_CADDYFILE"; exit 1
fi
CADDY_CHANGED=0
if ! sudo cmp -s "$NEW_CADDYFILE" /etc/caddy/Caddyfile; then
  CADDY_CHANGED=1
  if sudo test -f /etc/caddy/Caddyfile; then
    sudo cp -p /etc/caddy/Caddyfile "/etc/caddy/backups/Caddyfile.$(date +%Y%m%d-%H%M%S)"
    # Keep the 20 newest backups.
    sudo find /etc/caddy/backups -name 'Caddyfile.*' -type f | sort | head -n -20 | xargs -r sudo rm -f
  fi
fi
sudo mv "$NEW_CADDYFILE" /etc/caddy/Caddyfile
sudo restorecon /etc/caddy/Caddyfile 2>/dev/null || true
sudo install -m 644 "$BUNDLE/deploy/caddy.service" /etc/systemd/system/caddy.service
sudo install -m 644 "$BUNDLE/deploy/nicelydone.slice" /etc/systemd/system/nicelydone.slice
sudo sed -e "s|/opt/nicelydone|$APP|g" "$BUNDLE/deploy/nicelydone.service" | sudo tee /etc/systemd/system/nicelydone.service >/dev/null

echo "== firewall"
sudo firewall-cmd -q --permanent --add-service=http --add-service=https && sudo firewall-cmd -q --reload

echo "== ops (backups, monitor, auto-deploy)"
sudo install -d -m 755 /opt/nicelydone-ops /etc/nicelydone
sudo install -m 755 "$BUNDLE"/deploy/ops/*.sh /opt/nicelydone-ops/
sudo install -m 644 "$BUNDLE"/deploy/ops/nicelydone-*.service "$BUNDLE"/deploy/ops/nicelydone-*.timer /etc/systemd/system/
if ! sudo test -f /etc/nicelydone/ops.env; then
  printf '# Where alerts go — a Hermes target in double quotes, e.g. "photon:any;-;+9665XXXXXXXX". Empty = log only.\nNOTIFY_TARGET=\nNOTIFY_USER=opc\n' | sudo tee /etc/nicelydone/ops.env >/dev/null
  sudo chmod 600 /etc/nicelydone/ops.env
fi

echo "== services"
sudo systemctl daemon-reload
sudo systemctl enable -q nicelydone caddy
sudo systemctl enable -q --now nicelydone-backup.timer nicelydone-monitor.timer nicelydone-autodeploy.timer
sudo systemctl restart nicelydone
sleep 2
curl -fsS http://127.0.0.1:3080/api/health && echo
# Reload keeps every site up (a bad config is refused and the old one stays).
# Restart only when Caddy is not running yet or its binary was just upgraded.
if [ "${CADDY_UPGRADED:-0}" = 1 ] || ! sudo systemctl is-active -q caddy; then
  sudo systemctl restart caddy
elif [ "$CADDY_CHANGED" = 1 ]; then
  sudo systemctl reload caddy
fi
sudo systemctl --no-pager --lines=0 status nicelydone caddy | grep -E "●|Active"
