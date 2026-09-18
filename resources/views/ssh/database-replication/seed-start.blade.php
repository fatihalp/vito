sudo chmod 600 {!! escapeshellarg($passfile) !!}
sudo install -d -m 700 /var/lib/vito
sudo tee {!! escapeshellarg($path) !!} > /dev/null <<'VITO_REPLICA_SEED'
{!! $script !!}
VITO_REPLICA_SEED
sudo chmod 700 {!! escapeshellarg($path) !!}
sudo systemctl reset-failed {!! escapeshellarg($unit) !!} > /dev/null 2>&1 || true
sudo systemd-run --unit={!! escapeshellarg($unit) !!} --remain-after-exit --description='Vito PostgreSQL replica seed' /bin/bash {!! escapeshellarg($path) !!}
