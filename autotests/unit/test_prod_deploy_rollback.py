from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_remote_deploy_snapshots_application_before_replacing_files():
    script = (ROOT / "deploy/remote-deploy.sh").read_text(encoding="utf-8")
    snapshot = script.index('tar -czf "$SNAPSHOT"')
    replacement = script.index('find "$APP_DIR"')

    assert snapshot < replacement
    assert 'tar -tzf "$SNAPSHOT" >/dev/null' in script
    assert 'chmod 600 "$SNAPSHOT"' in script
    assert 'chmod 700 "$SNAPSHOT_DIR"' in script
    assert '"$(realpath -e "$APP_DIR")" != "$APP_DIR"' in script
    assert '"$(realpath -m "$APP_DIR")" != "$APP_DIR"' in script


def test_remote_deploy_restores_snapshot_after_failure_and_smokes_rollback():
    script = (ROOT / "deploy/remote-deploy.sh").read_text(encoding="utf-8")

    assert "trap 'rollback \"$?\"' ERR" in script
    assert 'tar -xzf "$SNAPSHOT" -C "$APP_PARENT"' in script
    assert 'cp -p "$NGINX_BACKUP" "$NGINX_CONF"' in script
    assert 'pm2 restart qastart --update-env' in script
    assert "npm run smoke:prod" in script
    assert "pm2 flush" not in script


def test_windows_deploy_invokes_checked_in_rollback_safe_script():
    script = (ROOT / "deploy/deploy-prod.ps1").read_text(encoding="utf-8")

    assert 'Join-Path $PSScriptRoot "remote-deploy.sh"' in script
    assert 'bash /tmp/qastart-remote-deploy.sh' in script
    assert '$AppDir -ne "/var/www/qastart"' in script
