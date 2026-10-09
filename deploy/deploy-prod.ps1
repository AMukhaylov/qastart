param(
  [string]$HostName = "89.108.78.48",
  [string]$User = "root",
  [int]$Port = 22,
  [string]$KeyPath = "$env:USERPROFILE\.ssh\qastart_reg_ru_ed25519",
  [string]$AppDir = "/var/www/qastart"
)

$ErrorActionPreference = "Stop"

if ($AppDir -ne "/var/www/qastart") {
  throw "Unexpected deployment target: $AppDir"
}
if (-not (Test-Path -LiteralPath $KeyPath -PathType Leaf)) {
  throw "Deployment SSH key was not found: $KeyPath"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$localDeployDir = Join-Path $repoRoot ".deploy"
$archive = Join-Path $localDeployDir "qastart-src.tgz"
$remoteDeployScript = Join-Path $PSScriptRoot "remote-deploy.sh"

Write-Host "Checking SSH ${HostName}:${Port}..."
ssh -i $KeyPath -p $Port -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new "${User}@${HostName}" "true"
if ($LASTEXITCODE -ne 0) {
  throw "SSH ${HostName}:${Port} is not reachable with the deployment key."
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
    --exclude="reports" `
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

scp -i $KeyPath -P $Port -o StrictHostKeyChecking=accept-new $archive "${User}@${HostName}:/tmp/qastart-deploy-src.tgz"
if ($LASTEXITCODE -ne 0) {
  throw "scp of source archive failed with exit code $LASTEXITCODE"
}

scp -i $KeyPath -P $Port -o StrictHostKeyChecking=accept-new $remoteDeployScript "${User}@${HostName}:/tmp/qastart-remote-deploy.sh"
if ($LASTEXITCODE -ne 0) {
  throw "scp of rollback-safe deploy script failed with exit code $LASTEXITCODE"
}

ssh -i $KeyPath -p $Port -o StrictHostKeyChecking=accept-new "${User}@${HostName}" "bash /tmp/qastart-remote-deploy.sh"
if ($LASTEXITCODE -ne 0) {
  throw "ssh deploy failed with exit code $LASTEXITCODE"
}
