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
(cd $APP/server && sudo HOME=/root /usr/bin/npm ci --omit=dev --no-audit --no-fund --loglevel=error)
sudo chown -R root:nicelydone $APP/server/node_modules && sudo chmod -R g+rX,o-rwx $APP/server/node_modules

echo "== mariadb"
sudo systemctl enable --now mariadb
if [ ! -f $APP/server/.env ]; then
  DBPW=$(openssl rand -hex 24); JWT=$(openssl rand -hex 48)
  sudo mysql -e "CREATE DATABASE IF NOT EXISTS passforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS 'passforge_app'@'localhost' IDENTIFIED BY '$DBPW';
    ALTER USER 'passforge_app'@'localhost' IDENTIFIED BY '$DBPW';
    GRANT SELECT, INSERT, UPDATE, DELETE ON passforge.* TO 'passforge_app'@'localhost'; FLUSH PRIVILEGES;"
  sudo mysql passforge < $APP/server/schema.sql
  sed -e "s/^JWT_SECRET=.*/JWT_SECRET=$JWT/" -e "s/^DB_PASSWORD=.*/DB_PASSWORD=$DBPW/" \
      -e "s|^STATIC_DIR=.*|STATIC_DIR=$APP/dist|" -e "s/^PORT=.*/PORT=3080/" \
      $APP/server/.env.example | sudo tee $APP/server/.env >/dev/null
  sudo chown root:nicelydone $APP/server/.env && sudo chmod 640 $APP/server/.env
  echo "   created database + .env (SMTP still to be filled in)"
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
  sudo restorecon -v /usr/local/bin/caddy || true
  rm -rf $T
fi
sudo mkdir -p /etc/caddy && sudo install -m 644 "$BUNDLE/deploy/Caddyfile" /etc/caddy/Caddyfile
sudo install -m 644 "$BUNDLE/deploy/caddy.service" /etc/systemd/system/caddy.service
sudo sed -e "s|/opt/nicelydone|$APP|g" "$BUNDLE/deploy/nicelydone.service" | sudo tee /etc/systemd/system/nicelydone.service >/dev/null

echo "== firewall"
sudo firewall-cmd -q --permanent --add-service=http --add-service=https && sudo firewall-cmd -q --reload

echo "== services"
sudo systemctl daemon-reload
sudo systemctl enable -q nicelydone caddy
sudo systemctl restart nicelydone
sleep 2
curl -fsS http://127.0.0.1:3080/api/health && echo
sudo systemctl restart caddy
sudo systemctl --no-pager --lines=0 status nicelydone caddy | grep -E "●|Active"
