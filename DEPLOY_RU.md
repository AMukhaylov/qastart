# Перенос qastart с Cloudflare на VPS

Cloudflare Workers плохо открывается у части пользователей из РФ, поэтому приложение лучше поднять на обычном VPS с Node.js и Nginx.

## Текущее состояние

- Продакшен: `https://startqa.ru`
- VPS: `89.108.78.48`
- Папка приложения: `/var/www/qastart`
- Процесс: `pm2` / `qastart`
- Nginx отдаёт приложение и проксирует `/supabase` в Supabase, чтобы браузер ходил к базе через домен сайта.
- Cloudflare сейчас не участвует в цепочке `startqa.ru`.
- Сборка больше не использует Lovable/Cloudflare Vite config: `vite.config.ts` настроен напрямую через TanStack Start, React, Tailwind и `vite-tsconfig-paths`.
- Вложения к домашним заданиям хранятся в приватном Supabase Storage bucket `homework-attachments`, ссылки выдаются временные.
- `npm audit` после обновления зависимостей показывает 0 уязвимостей.
- RLS-политики Supabase оптимизированы: проверка ролей перенесена в `private.has_role`, клиент больше не вызывает RPC `public.has_role` напрямую.
- Server functions защищены стандартным TanStack Start CSRF middleware в `src/start.ts`.

## Что нужно от сервера

- Ubuntu 22.04/24.04
- Node.js 22 LTS
- Nginx
- Домен `startqa.ru`, A-запись на IP сервера
- HTTPS через Let's Encrypt

## Переменные окружения

На сервере нужны реальные значения:

```env
SUPABASE_URL=https://bhvbydcddoxjfpcschzw.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_URL=https://startqa.ru/supabase
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` нельзя отдавать в браузер или хранить в публичном репозитории.

## Важные файлы деплоя

- `server.mjs` запускает собранное TanStack Start приложение на Node.js.
- `server.mjs` импортирует серверный entry из `dist/server/server.js`.
- `deploy/deploy-prod.ps1` выполняет полный деплой с Windows: архивирует исходники без `.env`, доставляет на VPS, пересобирает приложение, перезапускает `pm2` и запускает smoke-check.
- `deploy/nginx-startqa.ru` содержит конфиг Nginx для домена и прокси `/supabase`.
- `deploy/restore_lessons_route.py` нужен для безопасной доставки файла `src/routes/lessons.$day.tsx` на Linux-сервер: символ `$` легко ломается при shell-expansion.

## Деплой

Из корня проекта:

```powershell
npm run deploy:prod
```

Скрипт не переносит локальный `.env` и откажется продолжать деплой, если серверный `.env` указывает не на текущий Supabase-проект `bhvbydcddoxjfpcschzw`.

## DNS после переноса

Когда сервер готов:

- `startqa.ru` -> A -> IP VPS
- `www.startqa.ru` -> A/CNAME -> IP VPS или `startqa.ru`
- В Supabase Authentication добавить:
  - Site URL: `https://startqa.ru`
  - Redirect URLs: `https://startqa.ru/*`, `https://www.startqa.ru/*`

## Проверки после деплоя

```bash
curl -I https://startqa.ru/admin/homework
curl -I https://startqa.ru/lessons/1
pm2 status qastart
npm run smoke:prod
```

Обе страницы должны возвращать `200 OK`, процесс `qastart` должен быть `online`.
`npm run smoke:prod` дополнительно проверяет HTML-страницы, прокси `/supabase` через publishable key из `.env` и приватный Storage bucket `homework-attachments` через service-role key.
