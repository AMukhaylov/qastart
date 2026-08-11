param(
  [string]$HostName = "89.108.78.48",
  [string]$User = "root",
  [int]$Port = 22,
  [string]$KeyPath = "$env:USERPROFILE\.ssh\qastart_reg_ru_ed25519",
  [string]$AppDir = "/var/www/qastart"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$localDeployDir = Join-Path $repoRoot ".deploy"
$archive = Join-Path $localDeployDir "qastart-src.tgz"

Write-Host "Checking SSH ${HostName}:${Port}..."
$tcpClient = [System.Net.Sockets.TcpClient]::new()
try {
  $connect = $tcpClient.BeginConnect($HostName, $Port, $null, $null)
  if (-not $connect.AsyncWaitHandle.WaitOne(10000, $false)) {
    throw "SSH port ${HostName}:${Port} is not reachable. Open SSH on the VPS or pass -Port if it was changed."
  }
  $tcpClient.EndConnect($connect)
} finally {
  $tcpClient.Close()
}

New-Item -ItemType Directory -Force -Path $localDeployDir | Out-Null
if (Test-Path -LiteralPath $archive) {
  Remove-Item -LiteralPath $archive -Force
}

Push-Location $repoRoot
try {
  tar `
    --exclude=".git" `
    --exclude="node_modules" `
    --exclude="dist" `
    --exclude="supabase/.temp" `
    --exclude=".env" `
    --exclude=".env.*" `
    --exclude=".deploy" `
    -czf $archive .
  if ($LASTEXITCODE -ne 0) {
    throw "tar failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

scp -i $KeyPath -P $Port -o StrictHostKeyChecking=no $archive "${User}@${HostName}:/tmp/qastart-deploy-src.tgz"
if ($LASTEXITCODE -ne 0) {
  throw "scp failed with exit code $LASTEXITCODE"
}

$remoteScript = @'
set -euo pipefail

APP_DIR="__APP_DIR__"
if [ "$APP_DIR" != "/var/www/qastart" ]; then
  echo "Unexpected APP_DIR: $APP_DIR" >&2
  exit 1
fi

cd "$APP_DIR"
if [ ! -f .env ]; then
  echo "Missing $APP_DIR/.env; refusing to deploy" >&2
  exit 1
fi

upsert_env() {
  key="$1"
  value="$2"
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
upsert_env "VITE_SUPABASE_URL" "https://startqa.ru/supabase"

if ! grep -q "bhvbydcddoxjfpcschzw" .env; then
  echo "Server .env points to an unexpected Supabase project; refusing to deploy" >&2
  exit 1
fi

cp .env /tmp/qastart-env.backup
rm -rf /tmp/qastart-deploy-unpack
mkdir -p /tmp/qastart-deploy-unpack
tar -xzf /tmp/qastart-deploy-src.tgz -C /tmp/qastart-deploy-unpack

find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name ".env" -exec rm -rf {} +
cp -a /tmp/qastart-deploy-unpack/. "$APP_DIR/"
cp /tmp/qastart-env.backup "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

rm -f seed-test-data-retry.mjs seed-test-data.mjs verify-attachments.mjs

if [ -f "$APP_DIR/deploy/nginx-startqa.ru" ]; then
  cp "$APP_DIR/deploy/nginx-startqa.ru" /etc/nginx/sites-available/startqa.ru
  ln -sf /etc/nginx/sites-available/startqa.ru /etc/nginx/sites-enabled/startqa.ru
  nginx -t
  systemctl reload nginx
fi

npm ci
npm run lint
npm run build
pm2 restart qastart --update-env
pm2 flush qastart
npm run smoke:prod

echo "--- env ref ---"
grep '^SUPABASE_URL=' .env | sed -E 's#.*https://([^.]+).*#\1#'
echo "--- pm2 ---"
pm2 list | grep qastart || true
echo "--- errors ---"
tail -n 50 /root/.pm2/logs/qastart-error.log || true
'@

$remoteScript = $remoteScript.Replace("__APP_DIR__", $AppDir)
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteScript))
ssh -i $KeyPath -p $Port -o StrictHostKeyChecking=no "${User}@${HostName}" "printf '%s' '$encoded' | base64 -d | bash"
if ($LASTEXITCODE -ne 0) {
  throw "ssh deploy failed with exit code $LASTEXITCODE"
}
