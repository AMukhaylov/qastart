# Откат PROD-деплоя

`deploy/deploy-prod.ps1` отправляет и запускает `remote-deploy.sh`. Перед первой заменой файлов скрипт:

- проверяет фиксированный target `/var/www/qastart`, наличие `.env`, nginx config и архива релиза;
- сохраняет приложение целиком (включая `.env` и установленные зависимости) в `/var/backups/qastart/`;
- проверяет, что архив читается, и закрывает доступ к backups для остальных пользователей (`0700` каталог, `0600` файлы);
- копирует текущие nginx config и состояние `sites-enabled/startqa.ru`.

Если сборка, перезапуск или smoke завершаются ошибкой, `ERR` trap автоматически возвращает snapshot, восстанавливает nginx, перезапускает `qastart` и запускает `npm run smoke:prod`. Snapshot не удаляется после успешной выкладки — путь печатается в конце deployment.

Если автоматический rollback тоже не завершился успешно, оператор должен подключиться к PROD, выбрать именно напечатанный `qastart-predeploy-*.tar.gz` snapshot и восстановить его в `/var/www`:

```bash
tar -xzf /var/backups/qastart/<точный-snapshot>.tar.gz -C /var/www
cd /var/www/qastart
chmod 600 .env
nginx -t && systemctl reload nginx
pm2 restart qastart --update-env
npm run smoke:prod
```

Не запускай эту процедуру вручную параллельно с активным deployment. Наличие snapshot само по себе не доказывает успешную восстановительную репетицию; для этого нужен отдельный сервер/staging. DB migration rollback также не входит в файловый rollback и требует отдельного согласованного плана.
