if ! sudo supervisorctl reread; then
    echo 'VITO_SSH_ERROR' && exit 1
fi
if ! sudo supervisorctl update {{ $id }}; then
    echo 'VITO_SSH_ERROR' && exit 1
fi
@if (!empty($logFile))
if [ -f {{ $logFile }} ]; then
    echo -e "\n======================================================\n[$(date '+%Y-%m-%d %H:%M:%S')] >>> WORKER STARTED <<<\n======================================================\n" | sudo tee -a {{ $logFile }} > /dev/null 2>&1 || true
fi
@endif
if ! output=$(sudo supervisorctl start {{ $id }}:* 2>&1); then
    echo "$output"
    echo 'VITO_SSH_ERROR' && exit 1
fi
echo "$output"
if echo "$output" | grep ': ERROR' | grep -qvE 'already started|not running'; then
    echo 'VITO_SSH_ERROR' && exit 1
fi
