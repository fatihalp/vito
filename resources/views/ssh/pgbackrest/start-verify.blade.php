sudo systemctl stop {!! escapeshellarg($unit) !!} > /dev/null 2>&1 || true
sudo systemctl reset-failed {!! escapeshellarg($unit) !!} > /dev/null 2>&1 || true
sudo systemd-run --unit={!! escapeshellarg($unit) !!} --uid=postgres --gid=postgres --remain-after-exit --description='Vito pgBackRest verify' "$(command -v pgbackrest)" --stanza={!! escapeshellarg($stanza) !!} verify
