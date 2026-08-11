#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/qastart"
PROJECT_REF="bhvbydcddoxjfpcschzw"
NGINX_SITE="/etc/nginx/sites-available/startqa.ru"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root" >&2
  exit 1
fi

if [ ! -f "$APP_DIR/.env" ]; then
  echo "Missing $APP_DIR/.env" >&2
  exit 1
fi

if ! grep -q "$PROJECT_REF" "$APP_DIR/.env"; then
  echo "$APP_DIR/.env does not reference $PROJECT_REF; update Supabase env keys before restarting app." >&2
  exit 1
fi

cat > "$NGINX_SITE" <<NGINX
server {
    server_name startqa.ru www.startqa.ru 89.108.78.48;

    client_max_body_size 20m;

    location ^~ /supabase/ {
        proxy_pass https://$PROJECT_REF.supabase.co/;
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_set_header Host $PROJECT_REF.supabase.co;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90s;
        proxy_send_timeout 90s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass \$http_upgrade;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/startqa.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/startqa.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if (\$host = www.startqa.ru) {
        return 301 https://\$host\$request_uri;
    }

    if (\$host = startqa.ru) {
        return 301 https://\$host\$request_uri;
    }

    listen 80;
    server_name startqa.ru www.startqa.ru 89.108.78.48;
    return 404;
}
NGINX

ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/startqa.ru
nginx -t
systemctl reload nginx
pm2 restart qastart --update-env

curl -fsS "https://startqa.ru/supabase/auth/v1/settings" -H "apikey: $(grep '^VITE_SUPABASE_PUBLISHABLE_KEY=' "$APP_DIR/.env" | cut -d= -f2- | tr -d '\"')" >/dev/null
echo "Supabase proxy fixed."
