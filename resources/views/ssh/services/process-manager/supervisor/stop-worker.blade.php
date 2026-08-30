if ! output=$(sudo supervisorctl stop {{ $id }}:* 2>&1); then
    echo "$output"
    echo 'VITO_SSH_ERROR' && exit 1
fi
echo "$output"
if echo "$output" | grep ': ERROR' | grep -qvE 'not running'; then
    echo 'VITO_SSH_ERROR' && exit 1
fi
@if (!empty($logFile))
if [ -f {{ $logFile }} ]; then
    sudo truncate -s 0 {{ $logFile }}
fi
@endif
sudo truncate -s 0 /home/*/.logs/workers/{{ (int) $id }}.log /root/.logs/workers/{{ (int) $id }}.log 2>/dev/null || true


