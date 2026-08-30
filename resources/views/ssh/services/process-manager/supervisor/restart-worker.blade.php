if ! sudo supervisorctl reread; then
    echo 'VITO_SSH_ERROR' && exit 1
fi
if ! sudo supervisorctl update {{ $id }}; then
    echo 'VITO_SSH_ERROR' && exit 1
fi
sudo supervisorctl stop {{ $id }}:* > /dev/null 2>&1 || true
@if (!empty($logFile))
if [ -f {{ $logFile }} ]; then
    sudo truncate -s 0 {{ $logFile }}
fi
@endif
sudo truncate -s 0 /home/*/.logs/workers/{{ (int) $id }}.log /root/.logs/workers/{{ (int) $id }}.log 2>/dev/null || true
if ! output=$(sudo supervisorctl start {{ $id }}:* 2>&1); then
    echo "$output"
    echo 'VITO_SSH_ERROR' && exit 1
fi
echo "$output"
if echo "$output" | grep ': ERROR' | grep -qvE 'already started|not running'; then
    echo 'VITO_SSH_ERROR' && exit 1
fi
