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
    add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' wss://startqa.ru; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; font-src 'self' data: https://fonts.gstatic.com; media-src 'self'" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;

    location ^~ /supabase/ {
        proxy_pass https://bhvbydcddoxjfpcschzw.supabase.co/;
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_set_header Host bhvbydcddoxjfpcschzw.supabase.co;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
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
        proxy_set_header Connection "upgrade";
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
