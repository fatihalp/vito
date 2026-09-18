sudo install -d -m 700 /var/lib/vito
sudo tee {!! escapeshellarg($path) !!} > /dev/null <<'VITO_TRANSIENT_UNIT'
{!! $script !!}
VITO_TRANSIENT_UNIT
sudo chmod 700 {!! escapeshellarg($path) !!}
sudo systemctl stop {!! escapeshellarg($unit) !!} > /dev/null 2>&1 || true
sudo systemctl reset-failed {!! escapeshellarg($unit) !!} > /dev/null 2>&1 || true
sudo systemd-run --unit={!! escapeshellarg($unit) !!} --remain-after-exit --description={!! escapeshellarg($description) !!} /bin/bash {!! escapeshellarg($path) !!}
