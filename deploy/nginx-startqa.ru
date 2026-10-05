map $http_upgrade $qastart_connection_upgrade {
    default upgrade;
    '' close;
}

server {
    server_name startqa.ru www.startqa.ru 89.108.78.48;

    client_max_body_size 20m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
    # TanStack Start emits the SSR hydration and scroll-restoration bootstrap inline.
    # A nonce is not available at this Nginx layer, so keep inline scripts enabled until
    # the application owns nonce generation. The remaining directives stay restrictive.
    add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' https://bhvbydcddoxjfpcschzw.supabase.co wss://bhvbydcddoxjfpcschzw.supabase.co wss://startqa.ru; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; font-src 'self' data: https://fonts.gstatic.com; media-src 'self'" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;

    location ^~ /supabase/ {
        # Supabase can rotate CDN addresses. Resolve the host dynamically instead
        # of pinning the DNS answer Nginx received when it started.
        resolver 127.0.0.53 1.1.1.1 valid=60s ipv6=off;
        resolver_timeout 5s;
        set $supabase_host bhvbydcddoxjfpcschzw.supabase.co;
        rewrite ^/supabase(/.*)$ $1 break;
        proxy_pass https://$supabase_host;
        proxy_http_version 1.1;
        proxy_connect_timeout 5s;
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_next_upstream_tries 3;
        proxy_next_upstream_timeout 15s;
        proxy_ssl_server_name on;
        proxy_ssl_name $supabase_host;
        proxy_set_header Host $supabase_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        # Only mark actual WebSocket requests as upgrades. Ordinary REST calls
        # (including lesson imports) must use a regular HTTP connection.
        proxy_set_header Connection $qastart_connection_upgrade;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90s;
        proxy_send_timeout 90s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $qastart_connection_upgrade;
        proxy_cache_bypass $http_upgrade;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/startqa.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/startqa.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    listen 80;
    server_name startqa.ru www.startqa.ru 89.108.78.48;
    return 301 https://startqa.ru$request_uri;
}
