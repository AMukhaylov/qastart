#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/var/www/qastart"
APP_PARENT="/var/www"
SNAPSHOT_DIR="/var/backups/qastart"
NGINX_CONF="/etc/nginx/sites-available/startqa.ru"
NGINX_LINK="/etc/nginx/sites-enabled/startqa.ru"
UNPACK_DIR="/tmp/qastart-deploy-unpack"
SOURCE_ARCHIVE="/tmp/qastart-deploy-src.tgz"

if [[ "$APP_DIR" != "/var/www/qastart" || "$APP_PARENT" != "/var/www" ]]; then
  echo "Unexpected deployment target; refusing to continue" >&2
  exit 1
fi
if [[ ! -d "$APP_DIR" || -L "$APP_DIR" || "$(realpath -e "$APP_DIR")" != "$APP_DIR" || ! -f "$APP_DIR/.env" || ! -f "$NGINX_CONF" ]]; then
  echo "Expected production app, .env, or nginx config is missing; refusing to deploy" >&2
  exit 1
fi
if [[ ! -s "$SOURCE_ARCHIVE" ]]; then
  echo "Missing deployment source archive" >&2
  exit 1
fi

mkdir -p "$SNAPSHOT_DIR"
chmod 700 "$SNAPSHOT_DIR"
SNAPSHOT="$SNAPSHOT_DIR/qastart-predeploy-$(date -u +%Y%m%dT%H%M%SZ)-$$.tar.gz"
NGINX_BACKUP="$SNAPSHOT_DIR/nginx-predeploy-$(date -u +%Y%m%dT%H%M%SZ)-$$.conf"
NGINX_LINK_BACKUP="$SNAPSHOT_DIR/nginx-link-predeploy-$(date -u +%Y%m%dT%H%M%SZ)-$$.txt"
NGINX_LINK_FILE_BACKUP="$SNAPSHOT_DIR/nginx-link-predeploy-$(date -u +%Y%m%dT%H%M%SZ)-$$.file"

# The archive contains .env and node_modules so a failed deploy can be restored
# without network access. It is stored outside APP_DIR and only readable by root.
tar -czf "$SNAPSHOT" -C "$APP_PARENT" "$(basename "$APP_DIR")"
test -s "$SNAPSHOT"
tar -tzf "$SNAPSHOT" >/dev/null
chmod 600 "$SNAPSHOT"
cp -p "$NGINX_CONF" "$NGINX_BACKUP"
chmod 600 "$NGINX_BACKUP"
if [[ -L "$NGINX_LINK" ]]; then
  printf 'symlink:%s\n' "$(readlink "$NGINX_LINK")" > "$NGINX_LINK_BACKUP"
  chmod 600 "$NGINX_LINK_BACKUP"
elif [[ -e "$NGINX_LINK" ]]; then
  printf 'file\n' > "$NGINX_LINK_BACKUP"
  cp -p "$NGINX_LINK" "$NGINX_LINK_FILE_BACKUP"
  chmod 600 "$NGINX_LINK_BACKUP" "$NGINX_LINK_FILE_BACKUP"
else
  printf 'absent\n' > "$NGINX_LINK_BACKUP"
  chmod 600 "$NGINX_LINK_BACKUP"
fi

rollback() {
  local status="$1"
  trap - ERR
  if [[ "$status" -eq 0 ]]; then return; fi

  set +e
  echo "Deployment failed (status $status); restoring snapshot $SNAPSHOT" >&2
  if [[ -L "$APP_DIR" || "$(realpath -m "$APP_DIR")" != "$APP_DIR" ]]; then
    echo "Unexpected app path during rollback; refusing recursive restore" >&2
    exit "$status"
  fi
  rm -rf -- "$APP_DIR"
  tar -xzf "$SNAPSHOT" -C "$APP_PARENT"
  chmod 600 "$APP_DIR/.env"
  cp -p "$NGINX_BACKUP" "$NGINX_CONF"
  if [[ -L "$NGINX_LINK" ]]; then rm -f -- "$NGINX_LINK"; fi
  if [[ -f "$NGINX_LINK_BACKUP" ]]; then
    state="$(cat "$NGINX_LINK_BACKUP")"
    case "$state" in
      symlink:*) ln -sfn -- "${state#symlink:}" "$NGINX_LINK" ;;
      file) cp -p "$NGINX_LINK_FILE_BACKUP" "$NGINX_LINK" ;;
      absent) rm -f -- "$NGINX_LINK" ;;
      *) echo "Unknown nginx link backup state: $state" >&2 ;;
    esac
  fi
  nginx -t && systemctl reload nginx
  cd "$APP_DIR"
  pm2 restart qastart --update-env
  npm run smoke:prod
  echo "Rollback attempted from $SNAPSHOT" >&2
  exit "$status"
}
trap 'rollback "$?"' ERR

cd "$APP_DIR"

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

upsert_env "SUPABASE_URL" "https://bhvbydcddoxjfpcschzw.supabase.co"
upsert_env "SUPABASE_PUBLISHABLE_KEY" "sb_publishable_EihhWnfiwTJYBiHQXvah1g_xCqt0t5r"
upsert_env "VITE_SUPABASE_PROJECT_ID" "bhvbydcddoxjfpcschzw"
upsert_env "VITE_SUPABASE_PUBLISHABLE_KEY" "sb_publishable_EihhWnfiwTJYBiHQXvah1g_xCqt0t5r"
upsert_env "VITE_SUPABASE_URL" "https://bhvbydcddoxjfpcschzw.supabase.co"

if ! grep -q "bhvbydcddoxjfpcschzw" .env; then
  echo "Server .env points to an unexpected Supabase project; refusing to deploy" >&2
  exit 1
fi

rm -rf -- "$UNPACK_DIR"
mkdir -p "$UNPACK_DIR"
tar -xzf "$SOURCE_ARCHIVE" -C "$UNPACK_DIR"
find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name ".env" ! -name ".qastart-*" -exec rm -rf -- {} +
cp -a "$UNPACK_DIR"/. "$APP_DIR"/
chmod 600 "$APP_DIR/.env"

if [[ -f "$APP_DIR/deploy/nginx-startqa.ru" ]]; then
  cp "$APP_DIR/deploy/nginx-startqa.ru" "$NGINX_CONF"
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/startqa.ru
  nginx -t
  systemctl reload nginx
fi

npm ci
npm run lint -- --ignore-pattern '**/.qastart-*/**'
npm run typecheck
npm run build
pm2 restart qastart --update-env
npm run smoke:prod

trap - ERR
rm -rf -- "$UNPACK_DIR"
echo "Deploy succeeded. Rollback snapshot retained at $SNAPSHOT"
echo "Nginx rollback files retained at $NGINX_BACKUP, $NGINX_LINK_BACKUP, and $NGINX_LINK_FILE_BACKUP"
pm2 list | grep qastart || true
tail -n 50 /root/.pm2/logs/qastart-error.log || true
